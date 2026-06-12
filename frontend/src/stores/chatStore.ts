import { create } from 'zustand'
import type { ChatMessage, Conversation } from '@/types/chat'
import { chatService } from '@/services/chatService'
import { useAuthStore } from './authStore'

/**
 * Direct-message state.
 *
 * Data flow:
 *  - History/conversations load over REST (chatService).
 *  - New messages arrive in real time over the presence WebSocket
 *    (usePresenceSocket calls receiveMessage / applyRead / applyReadSelf).
 *  - Sends are optimistic: the bubble appears instantly with `pending: true`
 *    and is reconciled when the server echoes the saved message back.
 */
interface ChatState {
  conversations: Conversation[]
  /** Thread per friend, oldest → newest (display order). */
  threads: Record<string, ChatMessage[]>
  /** The friend whose thread is open (null = none). Open thread auto-marks read. */
  activeUserId: string | null
  isLoading: boolean

  totalUnread: () => number

  fetchConversations: () => Promise<void>
  openThread: (userId: string) => Promise<void>
  closeThread: () => void
  loadOlder: (userId: string) => Promise<void>
  sendMessage: (userId: string, body: string) => Promise<void>
  markRead: (userId: string) => Promise<void>

  // Real-time handlers (called from usePresenceSocket)
  receiveMessage: (message: ChatMessage) => void
  applyRead: (readerUserId: string, readAt: string) => void
  applyReadSelf: (partnerUserId: string) => void
}

function sortThread(msgs: ChatMessage[]): ChatMessage[] {
  return [...msgs].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
}

function myId(): string | null {
  return useAuthStore.getState().user?.id ?? null
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  threads: {},
  activeUserId: null,
  isLoading: false,

  totalUnread: () => get().conversations.reduce((sum, c) => sum + c.unreadCount, 0),

  fetchConversations: async () => {
    try {
      const conversations = await chatService.getConversations()
      // The thread I'm looking at is read by definition. The server may still
      // report unread > 0 here when this fetch races the mark-read POST (e.g.
      // first message from a "Start a chat" partner) — without this clamp the
      // stale count would overwrite the optimistic zero and the badge would
      // stick until the conversation is clicked again.
      const { activeUserId } = get()
      const clamped =
        activeUserId && document.visibilityState === 'visible'
          ? conversations.map((c) => (c.userId === activeUserId ? { ...c, unreadCount: 0 } : c))
          : conversations
      set({ conversations: clamped })
    } catch {
      /* network blip — keep current state */
    }
  },

  openThread: async (userId) => {
    set({ activeUserId: userId, isLoading: true })
    try {
      const page = await chatService.getThread(userId)
      set((s) => ({ threads: { ...s.threads, [userId]: sortThread(page) }, isLoading: false }))
      await get().markRead(userId)
    } catch {
      set({ isLoading: false })
    }
  },

  closeThread: () => set({ activeUserId: null }),

  loadOlder: async (userId) => {
    const thread = get().threads[userId]
    if (!thread || thread.length === 0) return
    const oldest = thread[0].sentAt
    try {
      const page = await chatService.getThread(userId, oldest)
      if (page.length === 0) return
      set((s) => ({
        threads: { ...s.threads, [userId]: sortThread([...page, ...(s.threads[userId] ?? [])]) },
      }))
    } catch {
      /* ignore */
    }
  },

  sendMessage: async (userId, body) => {
    const me = myId()
    const trimmed = body.trim()
    if (!me || !trimmed) return

    // Optimistic bubble — replaced by the server echo (matched by temp id).
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimistic: ChatMessage = {
      id: tempId,
      senderId: me,
      recipientId: userId,
      body: trimmed,
      sentAt: new Date().toISOString(),
      readAt: null,
      pending: true,
    }
    set((s) => ({
      threads: { ...s.threads, [userId]: [...(s.threads[userId] ?? []), optimistic] },
    }))

    try {
      const saved = await chatService.send(userId, trimmed)
      set((s) => ({
        threads: {
          ...s.threads,
          // The socket echo may have already appended the saved message — dedupe.
          [userId]: sortThread(
            (s.threads[userId] ?? [])
              .filter((m) => m.id !== tempId && m.id !== saved.id)
              .concat(saved),
          ),
        },
      }))
      get().fetchConversations()
    } catch {
      // Send failed — drop the optimistic bubble.
      set((s) => ({
        threads: { ...s.threads, [userId]: (s.threads[userId] ?? []).filter((m) => m.id !== tempId) },
      }))
    }
  },

  markRead: async (userId) => {
    // Optimistically clear the badge for this conversation.
    set((s) => ({
      conversations: s.conversations.map((c) => (c.userId === userId ? { ...c, unreadCount: 0 } : c)),
    }))
    try {
      await chatService.markRead(userId)
    } catch {
      /* ignore — will resync on next fetch */
    }
  },

  // ── Real-time handlers ─────────────────────────────────────────────────────

  receiveMessage: (message) => {
    const me = myId()
    if (!me) return
    const partnerId = message.senderId === me ? message.recipientId : message.senderId
    const { activeUserId } = get()

    set((s) => {
      // Append to the thread if it's loaded. Dedupe by id, and drop one matching
      // optimistic bubble (the socket echo of my own send arrives before the REST
      // response reconciles it).
      const thread = s.threads[partnerId]
      let threads = s.threads
      if (thread && !thread.some((m) => m.id === message.id)) {
        const matchingPendingIdx = thread.findIndex(
          (m) => m.pending && m.senderId === message.senderId && m.body === message.body,
        )
        const withoutPending =
          matchingPendingIdx >= 0 ? thread.filter((_, i) => i !== matchingPendingIdx) : thread
        threads = { ...s.threads, [partnerId]: sortThread([...withoutPending, message]) }
      }

      // Update / create the conversation summary.
      const isInbound = message.senderId !== me
      const existing = s.conversations.find((c) => c.userId === partnerId)
      const isThreadOpenAndVisible = activeUserId === partnerId && document.visibilityState === 'visible'
      const unreadDelta = isInbound && !isThreadOpenAndVisible ? 1 : 0

      const conversations = existing
        ? s.conversations.map((c) =>
            c.userId === partnerId
              ? { ...c, lastMessage: message, unreadCount: c.unreadCount + unreadDelta }
              : c,
          )
        : s.conversations // unknown partner (first-ever message) — fetch below fills name/avatar

      return { threads, conversations }
    })

    // First message from someone new: pull conversations to get their name/avatar.
    if (!get().conversations.some((c) => c.userId === partnerId)) {
      get().fetchConversations()
    }

    // If I'm looking at this thread right now, immediately mark it read.
    if (message.senderId !== me && activeUserId === partnerId && document.visibilityState === 'visible') {
      get().markRead(partnerId)
    }
  },

  applyRead: (readerUserId, readAt) => {
    const me = myId()
    if (!me) return
    // The friend read my messages — flip ✓ to ✓✓ in their thread.
    set((s) => {
      const thread = s.threads[readerUserId]
      if (!thread) return s
      return {
        threads: {
          ...s.threads,
          [readerUserId]: thread.map((m) =>
            m.senderId === me && !m.readAt ? { ...m, readAt } : m,
          ),
        },
      }
    })
  },

  applyReadSelf: (partnerUserId) => {
    // Another of my tabs marked this conversation read — clear the badge here too.
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.userId === partnerUserId ? { ...c, unreadCount: 0 } : c,
      ),
    }))
  },
}))

// Clear all chat state the moment the user logs out — same pattern as libraryStore.
useAuthStore.subscribe((state, prev) => {
  if (!prev.isAuthenticated || state.isAuthenticated) return
  useChatStore.setState({
    conversations: [],
    threads: {},
    activeUserId: null,
    isLoading: false,
  })
})
