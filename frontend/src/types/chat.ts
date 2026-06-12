export interface ChatMessage {
  id: string
  senderId: string
  recipientId: string
  body: string
  sentAt: string
  readAt: string | null
  /** Local-only: true while an optimistic send is awaiting the server. */
  pending?: boolean
}

export interface Conversation {
  userId: string
  name: string
  avatarUrl: string | null
  lastMessage: ChatMessage | null
  unreadCount: number
}
