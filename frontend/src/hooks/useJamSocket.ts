import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAuthStore } from '@/stores/authStore'
import { useJamStore } from '@/stores/jamStore'
import { usePlayerStore } from '@/stores/playerStore'
import type { Track } from '@/types/track'
import { notify } from '@/utils/toast'

interface JamSyncPayload {
  track: Track | null
  positionMs: number
  isPlaying: boolean
  at: number
}

/**
 * Drives the listen-along ("Jam") SignalR connection from jamStore.role.
 *  - Host: opens a session and broadcasts its playback state (track + position
 *    + play/pause) on every change and every 2s.
 *  - Guest: joins the host's session and mirrors incoming state onto the local
 *    player, correcting drift (>1.5s) and accounting for network latency.
 * Mount once (AppShell).
 */
export function useJamSocket() {
  const role = useJamStore((s) => s.role)
  const hostId = useJamStore((s) => s.hostId)
  const accessToken = useAuthStore((s) => s.accessToken)
  const connRef = useRef<signalR.HubConnection | null>(null)

  useEffect(() => {
    if (role === 'off' || !accessToken) {
      connRef.current?.stop()
      connRef.current = null
      return
    }

    let disposed = false
    let joinedAt = 0
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_URL ?? ''}/hubs/session`, {
        accessTokenFactory: () => useAuthStore.getState().accessToken ?? '',
      })
      .withAutomaticReconnect([0, 1000, 3000, 5000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()
    connRef.current = conn

    conn.on('JamParticipants', (n: number) => useJamStore.getState().setParticipants(n))
    conn.on('JamEnded', () => {
      const wasGuest = useJamStore.getState().role === 'guest'
      const justJoined = joinedAt > 0 && Date.now() - joinedAt < 4000
      useJamStore.getState().stopJam()
      if (wasGuest) {
        notify.error(justJoined ? "Couldn't join — host isn't in a Jam right now." : 'The host ended the Jam.')
      }
    })

    // Re-register with the hub after a dropped connection reconnects, otherwise
    // the in-memory session is lost server-side while the client still thinks
    // it's in a jam.
    conn.onreconnected(() => {
      const r = useJamStore.getState()
      if (r.role === 'host') conn.invoke('StartSession').catch(() => {})
      else if (r.role === 'guest' && r.hostId) conn.invoke('JoinSession', r.hostId).catch(() => {})
    })

    // ── Guest: mirror the host's state ───────────────────────────────────────
    const applySync = (p: JamSyncPayload) => {
      if (useJamStore.getState().role !== 'guest' || !p.track) return
      const player = usePlayerStore.getState()
      const latencyS = p.isPlaying ? Math.max(0, (Date.now() - p.at) / 1000) : 0
      const target = p.positionMs / 1000 + latencyS

      if (player.currentTrack?.id !== p.track.id) {
        player.play(p.track, [p.track])
      }
      if (Math.abs(player.currentTime - target) > 1.5) player.seek(target)
      if (p.isPlaying && !usePlayerStore.getState().isPlaying) player.resume()
      else if (!p.isPlaying && usePlayerStore.getState().isPlaying) player.pause()
    }
    conn.on('JamSync', applySync)

    // ── Host: broadcast current state ────────────────────────────────────────
    const broadcast = () => {
      if (useJamStore.getState().role !== 'host' || conn.state !== signalR.HubConnectionState.Connected) return
      const { currentTrack, currentTime, isPlaying } = usePlayerStore.getState()
      const payload: JamSyncPayload = {
        track: currentTrack,
        positionMs: Math.round(currentTime * 1000),
        isPlaying,
        at: Date.now(),
      }
      conn.invoke('Sync', payload).catch(() => {})
    }
    conn.on('JamJoined', broadcast) // a guest joined → push state immediately

    let unsubPlayer: (() => void) | null = null
    let interval: number | null = null

    conn.start()
      .then(async () => {
        if (disposed) return
        if (role === 'host') {
          await conn.invoke('StartSession').catch(() => {})
          // Immediate broadcast on track / play-pause change.
          let prevKey = ''
          unsubPlayer = usePlayerStore.subscribe((s) => {
            const key = `${s.currentTrack?.id ?? ''}|${s.isPlaying}`
            if (key !== prevKey) { prevKey = key; broadcast() }
          })
          interval = window.setInterval(broadcast, 2000)
          broadcast()
        } else if (role === 'guest' && hostId) {
          joinedAt = Date.now()
          await conn.invoke('JoinSession', hostId).catch(() => {})
        }
      })
      .catch((err) => {
        console.warn('[Jam] connection failed:', err)
        const reason = (err as Error | undefined)?.message ?? 'unknown error'
        const r = useJamStore.getState().role
        if (r === 'host') {
          notify.error(`Jam couldn't connect: ${reason}`)
        } else if (r === 'guest') {
          notify.error(`Couldn't connect to the Jam: ${reason}`)
        }
      })

    return () => {
      disposed = true
      unsubPlayer?.()
      if (interval) clearInterval(interval)
      const r = useJamStore.getState().role
      // Best-effort tell the server before tearing down.
      if (conn.state === signalR.HubConnectionState.Connected) {
        if (role === 'host') conn.invoke('EndSession').catch(() => {})
        else if (role === 'guest' && hostId) conn.invoke('LeaveSession', hostId).catch(() => {})
      }
      void r
      conn.stop()
      connRef.current = null
    }
  }, [role, hostId, accessToken])
}
