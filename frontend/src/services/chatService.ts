import type { ChatMessage, Conversation } from '@/types/chat'
import { api } from './api'

// NOTE on encryption: bodies travel and persist as PLAINTEXT for now.
// The planned end-to-end encryption flow (encrypt before send, decrypt after
// receive) is documented in src/utils/chatEncryption.ts — when enabled, this
// service is where encrypt()/decrypt() get applied.

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

  async send(userId: string, body: string): Promise<ChatMessage> {
    const res = await api.post<ChatMessage>(`/chat/with/${userId}`, { body })
    return res.data
  },

  async markRead(userId: string): Promise<void> {
    await api.post(`/chat/with/${userId}/read`)
  },
}
