import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAuthStore } from '@/stores/authStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useConnectStore, isThisDeviceActive, type ConnectDevice } from '@/stores/connectStore'
import { audioEngine } from '@/services/audioEngine'
import {
  connectClient,
  setConnectConnection,
  type RemotePlaybackState,
  type ConnectCommand,
} from '@/services/connectClient'

// Guards the auto-takeover: true while we're applying the active device's state
// to our own player, so mirroring a remote track isn't mistaken for the user
// starting playback here (which would bounce control back).
let applyingRemote = false

// True from the moment a local transport action on a non-active tab asks to take
// over until this tab is confirmed active. Stops the mirror (heartbeat + ticker)
// from overwriting the user's action during the transfer round-trip.
let takingOver = false

// Wall-clock of the previous mirror step, so a non-active tab can advance its own
// progress bar smoothly between the active device's heartbeats (client-side
// prediction) instead of stepping only when a message arrives.
let mirrorClock = 0

/**
 * Reflect the active device's playback into this tab's player bar so a non-active
 * tab shows the same song, play/pause state and moving progress (Spotify-style)
 * instead of looking paused. Audio stays silent here — the engine is gated by
 * connectActive.
 *
 * Position uses client-side prediction: normally we just advance the local clock
 * (no backward hitch when a heartbeat lands), and only snap to the authoritative
 * remote position on a track change, a play/pause change, or a large drift (a real
 * seek on the active device). `hardResync` forces the snap for those instant cases.
 */
function mirrorStep(hardResync: boolean) {
  if (takingOver) return
  const now = performance.now()
  const dt = mirrorClock === 0 ? 0 : Math.max(0, (now - mirrorClock) / 1000)
  mirrorClock = now

  const remote = useConnectStore.getState().remoteState
  if (!remote || !remote.track) return

  const player = usePlayerStore.getState()
  const trackChanged = player.currentTrack?.id !== remote.track.id
  // Authoritative position: what the active device reported, projected forward by
  // the time since it captured that sample.
  const anchor = remote.positionMs / 1000 +
    (remote.isPlaying ? Math.max(0, (Date.now() - remote.at) / 1000) : 0)
  const durSec = remote.track.durationMs ? remote.track.durationMs / 1000 : Infinity

  let pos: number
  if (hardResync || trackChanged || !remote.isPlaying) {
    pos = anchor
  } else {
    const predicted = player.currentTime + dt
    // Snap only when we've drifted too far from the source (i.e. a seek); otherwise
    // keep predicting locally so the bar moves smoothly and never jumps backward.
    pos = Math.abs(predicted - anchor) > 1.5 ? anchor : predicted
  }

  applyingRemote = true
  try {
    usePlayerStore.getState().mirrorRemote(remote.track, Math.min(pos, durSec), remote.isPlaying)
  } finally {
    applyingRemote = false
  }
}

/**
 * Drives the Spotify-Connect (/hubs/connect) session for this tab:
 *  - registers this tab as a device on the account,
 *  - keeps the device roster + active device in connectStore,
 *  - gates the audio engine so only the active device makes sound,
 *  - mirrors the active device's now-playing (for remote control), and
 *  - relays transport commands + auto-takes-over when the user plays here.
 * Mount once (AppShell).
 */
export function useConnectSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const accessToken = useAuthStore((s) => s.accessToken)
  const connRef = useRef<signalR.HubConnection | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      connRef.current?.stop()
      connRef.current = null
      setConnectConnection(null)
      audioEngine.setConnectActive(true)
      return
    }

    const { thisDeviceId, thisDeviceKind, thisDeviceName } = useConnectStore.getState()
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_URL ?? ''}/hubs/connect`, {
        accessTokenFactory: () => useAuthStore.getState().accessToken ?? '',
      })
      .withAutomaticReconnect([0, 1000, 3000, 5000, 10_000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()
    connRef.current = conn
    setConnectConnection(conn)

    // ── Roster / active-device changes ──────────────────────────────────────
    conn.on('ConnectDevices', (devices: ConnectDevice[], activeId: string | null) => {
      const wasActive = isThisDeviceActive()
      useConnectStore.getState().setRoster(devices, activeId)
      const nowActive = isThisDeviceActive()
      audioEngine.setConnectActive(nowActive)

      if (nowActive) {
        // Adopt the last mirrored state only when control arrives *without* a local
        // action (e.g. a device transfer). When this tab took over by the user
        // pressing a transport control, its local state already reflects the intent
        // — re-adopting the remote would clobber it (e.g. bounce a pause back to play).
        if (!wasActive && !takingOver) {
          const remote = useConnectStore.getState().remoteState
          if (remote?.track) {
            applyingRemote = true
            const player = usePlayerStore.getState()
            if (player.currentTrack?.id !== remote.track.id) player.play(remote.track, [remote.track])
            player.seek(remote.positionMs / 1000)
            if (remote.isPlaying) player.resume()
            else player.pause()
            applyingRemote = false
          }
        }
        takingOver = false
        // Push our state on *every* roster change (a takeover, or a new tab
        // joining) so mirrors sync immediately instead of waiting for the next
        // heartbeat. This is what stops a handed-off tab needing a refresh.
        report()
      } else {
        // Not the active device → mirror it (don't force paused). remoteState may
        // be null until the active device's report arrives; that will mirror then.
        mirrorStep(true)
      }
    })

    // ── Mirror: reflect what the active device is playing ────────────────────
    conn.on('ConnectState', (state: RemotePlaybackState) => {
      const prev = useConnectStore.getState().remoteState
      useConnectStore.getState().setRemoteState(state)
      if (isThisDeviceActive()) return
      // Snap instantly on a song change or play/pause flip; leave a plain position
      // heartbeat to the smooth local prediction so the bar doesn't hitch.
      const changed = prev?.track?.id !== state.track?.id || prev?.isPlaying !== state.isPlaying
      mirrorStep(changed)
    })

    // ── Active device: apply a remote's transport command ────────────────────
    conn.on('ConnectCommand', (command: ConnectCommand) => {
      if (!isThisDeviceActive()) return
      const player = usePlayerStore.getState()
      if (command === 'play') player.resume()
      else if (command === 'pause') player.pause()
      else if (command === 'next') player.skipNext()
      else if (command === 'prev') player.skipPrevious()
    })

    conn.onreconnected(() => connectClient.register(thisDeviceId, thisDeviceKind, thisDeviceName))

    // ── Active device: broadcast playback state (on change + heartbeat) ──────
    const report = () => {
      if (!isThisDeviceActive()) return
      const { currentTrack, currentTime, isPlaying } = usePlayerStore.getState()
      connectClient.report({
        track: currentTrack,
        positionMs: Math.round(currentTime * 1000),
        isPlaying,
        at: Date.now(),
      })
    }

    let interval: number | null = null
    let mirrorTick: number | null = null
    let unsubPlayer: (() => void) | null = null

    conn.start()
      .then(() => {
        connectClient.register(thisDeviceId, thisDeviceKind, thisDeviceName)
        let prevKey = ''
        let prevTrackId: string | null = usePlayerStore.getState().currentTrack?.id ?? null
        let prevIsPlaying = usePlayerStore.getState().isPlaying
        unsubPlayer = usePlayerStore.subscribe((s) => {
          // Any local transport action (new track, play, pause, skip) on a tab
          // that isn't the active device means the user is driving playback from
          // here → take over so this tab becomes the sound source. Mirror-driven
          // updates carry applyingRemote and are ignored.
          const transportChanged =
            s.currentTrack?.id !== prevTrackId || s.isPlaying !== prevIsPlaying
          prevTrackId = s.currentTrack?.id ?? null
          prevIsPlaying = s.isPlaying
          if (transportChanged && !applyingRemote && !isThisDeviceActive() && s.currentTrack != null) {
            takingOver = true
            connectClient.transfer(thisDeviceId)
          }
          // Active device pushes on track / play-pause change (position on the heartbeat).
          const key = `${s.currentTrack?.id ?? ''}|${s.isPlaying}`
          if (key !== prevKey) {
            prevKey = key
            report()
          }
        })
        // Heartbeat: 1s keeps mirror position anchors fresh (was 2s — the wider
        // gap let drift build up and made the mirror hitch on each correction).
        interval = window.setInterval(report, 1000)
        // Mirror ticker: advance a non-active tab's progress every 250ms via local
        // prediction so the bar moves smoothly, not in visible steps.
        mirrorTick = window.setInterval(() => {
          if (isThisDeviceActive()) return
          mirrorStep(false)
        }, 250)
      })
      .catch((err) => console.warn('[Connect] connection failed:', err))

    return () => {
      if (interval) clearInterval(interval)
      if (mirrorTick) clearInterval(mirrorTick)
      takingOver = false
      unsubPlayer?.()
      setConnectConnection(null)
      audioEngine.setConnectActive(true)
      conn.stop()
      connRef.current = null
    }
  }, [isAuthenticated, accessToken])
}
