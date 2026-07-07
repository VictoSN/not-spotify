import * as signalR from '@microsoft/signalr'
import type { Track } from '@/types/track'

/**
 * Thin wrapper around the /hubs/connect SignalR connection so any component or
 * store can drive Spotify-Connect device control without holding the connection
 * itself. The connection is owned by useConnectSocket, which calls
 * setConnectConnection() on start/stop.
 */

export interface RemotePlaybackState {
  track: Track | null
  positionMs: number
  isPlaying: boolean
  /** epoch ms the sender captured this at (for latency-aware display later). */
  at: number
}

export type ConnectCommand = 'play' | 'pause' | 'next' | 'prev'

let conn: signalR.HubConnection | null = null

export function setConnectConnection(c: signalR.HubConnection | null) {
  conn = c
}

function invoke(method: string, ...args: unknown[]) {
  if (conn && conn.state === signalR.HubConnectionState.Connected) {
    conn.invoke(method, ...args).catch(() => {})
  }
}

export const connectClient = {
  register: (deviceId: string, kind: string, name: string) => invoke('RegisterDevice', deviceId, kind, name),
  transfer: (deviceId: string) => invoke('TransferPlayback', deviceId),
  report: (state: RemotePlaybackState) => invoke('ReportState', state),
  command: (command: ConnectCommand, payload: unknown = null) => invoke('SendCommand', command, payload),
}
