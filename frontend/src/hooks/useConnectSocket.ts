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

      if (nowActive && !wasActive) {
        // Took over playback → adopt the last mirrored state and continue here.
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
      } else if (!nowActive && wasActive) {
        // Handed control off → go silent and show paused locally.
        usePlayerStore.getState().pause()
      }
    })

    // ── Mirror: remember what the active device is playing ───────────────────
    conn.on('ConnectState', (state: RemotePlaybackState) => {
      useConnectStore.getState().setRemoteState(state)
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
    let unsubPlayer: (() => void) | null = null

    conn.start()
      .then(() => {
        connectClient.register(thisDeviceId, thisDeviceKind, thisDeviceName)
        let prevKey = ''
        let prevTrackId: string | null = usePlayerStore.getState().currentTrack?.id ?? null
        let prevIsPlaying = usePlayerStore.getState().isPlaying
        unsubPlayer = usePlayerStore.subscribe((s) => {
          const startedNew = s.currentTrack != null &&
            (s.currentTrack.id !== prevTrackId || (s.isPlaying && !prevIsPlaying))
          prevTrackId = s.currentTrack?.id ?? null
          prevIsPlaying = s.isPlaying
          // The user started playback on a device that isn't active → take over.
          if (startedNew && !applyingRemote && !isThisDeviceActive()) {
            connectClient.transfer(thisDeviceId)
          }
          // Active device pushes on track / play-pause change (position on the heartbeat).
          const key = `${s.currentTrack?.id ?? ''}|${s.isPlaying}`
          if (key !== prevKey) {
            prevKey = key
            report()
          }
        })
        interval = window.setInterval(report, 2000)
      })
      .catch((err) => console.warn('[Connect] connection failed:', err))

    return () => {
      if (interval) clearInterval(interval)
      unsubPlayer?.()
      setConnectConnection(null)
      audioEngine.setConnectActive(true)
      conn.stop()
      connRef.current = null
    }
  }, [isAuthenticated, accessToken])
}
