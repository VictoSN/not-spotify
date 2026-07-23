import type { ChatMessage, Conversation } from '@/types/chat'
import { api } from './api'
import { presenceClient } from './presenceClient'

// HTTPS/WSS protects bodies in transit and the API encrypts them at rest.
// This client still handles plaintext because end-to-end encryption is not enabled.
//
// TRANSPORT: like WhatsApp, live chat rides the WebSocket — sending a message and
// the delivery/read receipts go over the PresenceHub socket (presenceClient),
// NOT over REST. Only history (conversations + thread backlog) is loaded over HTTP.

export const chatService = {
  async getConversations(): Promise<Conversation[]> {
    const res = await api.get<Conversation[]>('/chat/conversations')
    return res.data
  },

  /** Newest page first; pass `before` (ISO date) to page further back. */
  async getThread(userId: string, before?: string, limit = 50): Promise<ChatMessage[]> {
    const res = await api.get<ChatMessage[]>(`/chat/with/${userId}`, {
      params: { before, limit },
    })
    return res.data
  },

  send(userId: string, body: string): Promise<ChatMessage> {
    return presenceClient.sendMessage(userId, body)
  },

  markRead(userId: string): Promise<void> {
    return presenceClient.markRead(userId)
  },

  markDelivered(): Promise<void> {
    return presenceClient.markDelivered()
  },
}
