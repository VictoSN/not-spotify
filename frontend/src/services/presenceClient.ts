import * as signalR from '@microsoft/signalr'
import type { ChatMessage } from '@/types/chat'

/**
 * Thin wrapper around the /hubs/presence SignalR connection so the chat store
 * and service can send messages + receipts over the socket without owning the
 * connection. The connection is owned by usePresenceSocket, which calls
 * setPresenceConnection() on start/stop.
 *
 * This is the send half of WhatsApp-style chat: outgoing messages and receipts
 * are invoked over the socket here; incoming ones arrive via the connection.on
 * handlers in usePresenceSocket. REST is used only for loading old history.
 */

let conn: signalR.HubConnection | null = null

export function setPresenceConnection(c: signalR.HubConnection | null) {
  conn = c
}

function requireConnected(): signalR.HubConnection {
  if (!conn || conn.state !== signalR.HubConnectionState.Connected) {
    throw new Error("You're offline. Reconnecting…")
  }
  return conn
}

export const presenceClient = {
  /** Send a message over the socket; resolves with the saved message (server echo). */
  sendMessage: (recipientId: string, body: string): Promise<ChatMessage> =>
    requireConnected().invoke<ChatMessage>('SendMessage', recipientId, body),

  /** Mark all of my undelivered messages delivered (fire-and-forget). */
  markDelivered: (): Promise<void> =>
    conn?.state === signalR.HubConnectionState.Connected
      ? conn.invoke('MarkDelivered').catch(() => {})
      : Promise.resolve(),

  /** Mark a conversation read (fire-and-forget). */
  markRead: (partnerId: string): Promise<void> =>
    conn?.state === signalR.HubConnectionState.Connected
      ? conn.invoke('MarkRead', partnerId).catch(() => {})
      : Promise.resolve(),
}
