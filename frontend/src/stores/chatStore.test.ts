import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from './chatStore'
import { useAuthStore } from './authStore'
import type { ChatMessage, Conversation } from '@/types/chat'

const msg = (over: Partial<ChatMessage>): ChatMessage => ({
  id: Math.random().toString(36).slice(2),
  senderId: 'me',
  recipientId: 'friend',
  body: 'x',
  sentAt: new Date().toISOString(),
  deliveredAt: null,
  readAt: null,
  ...over,
})

const convo = (over: Partial<Conversation>): Conversation => ({
  userId: 'friend',
  name: 'Friend',
  avatarUrl: null,
  lastMessage: null,
  unreadCount: 0,
  ...over,
})

beforeEach(() => {
  useChatStore.setState({ conversations: [], threads: {}, activeUserId: null, isLoading: false })
  // myId() reads useAuthStore.getState().user?.id
  useAuthStore.setState({ user: { id: 'me' } as never })
})

describe('chatStore', () => {
  it('totalUnread sums unread counts across conversations', () => {
    useChatStore.setState({
      conversations: [convo({ userId: 'a', unreadCount: 2 }), convo({ userId: 'b', unreadCount: 3 })],
    })
    expect(useChatStore.getState().totalUnread()).toBe(5)
  })

  it('applyReadSelf clears unread for only the named conversation', () => {
    useChatStore.setState({
      conversations: [convo({ userId: 'a', unreadCount: 4 }), convo({ userId: 'b', unreadCount: 1 })],
    })
    useChatStore.getState().applyReadSelf('a')
    const cs = useChatStore.getState().conversations
    expect(cs.find((c) => c.userId === 'a')!.unreadCount).toBe(0)
    expect(cs.find((c) => c.userId === 'b')!.unreadCount).toBe(1)
  })

  it('applyRead flips my own unread sent messages to read, leaving the friend’s untouched', () => {
    const readAt = '2026-06-15T00:00:00.000Z'
    useChatStore.setState({
      threads: {
        friend: [
          msg({ id: 'm1', senderId: 'me', recipientId: 'friend', readAt: null }),
          msg({ id: 'm2', senderId: 'friend', recipientId: 'me', readAt: null }),
        ],
      },
    })
    useChatStore.getState().applyRead('friend', readAt)
    const t = useChatStore.getState().threads.friend
    expect(t.find((m) => m.id === 'm1')!.readAt).toBe(readAt)
    expect(t.find((m) => m.id === 'm2')!.readAt).toBeNull()
  })

  it('applyDelivered updates only my outbound messages for that recipient', () => {
    const deliveredAt = '2026-06-15T00:00:00.000Z'
    useChatStore.setState({
      threads: {
        friend: [
          msg({ id: 'm1', senderId: 'me', recipientId: 'friend' }),
          msg({ id: 'm2', senderId: 'friend', recipientId: 'me' }),
        ],
      },
    })

    useChatStore.getState().applyDelivered('friend', deliveredAt)

    const thread = useChatStore.getState().threads.friend
    expect(thread.find((message) => message.id === 'm1')!.deliveredAt).toBe(deliveredAt)
    expect(thread.find((message) => message.id === 'm2')!.deliveredAt).toBeNull()
  })

  it('receiveMessage bumps unread for an inbound message to an inactive conversation', () => {
    useChatStore.setState({
      conversations: [convo({ userId: 'friend', unreadCount: 0 })],
      activeUserId: null,
    })
    useChatStore.getState().receiveMessage(msg({ id: 'm1', senderId: 'friend', recipientId: 'me', body: 'hi' }))
    const c = useChatStore.getState().conversations.find((c) => c.userId === 'friend')!
    expect(c.unreadCount).toBe(1)
    expect(c.lastMessage?.id).toBe('m1')
  })

  it('receiveMessage does not bump unread for my own outbound message', () => {
    useChatStore.setState({
      conversations: [convo({ userId: 'friend', unreadCount: 0 })],
      activeUserId: null,
    })
    useChatStore.getState().receiveMessage(msg({ id: 'm2', senderId: 'me', recipientId: 'friend', body: 'yo' }))
    const c = useChatStore.getState().conversations.find((c) => c.userId === 'friend')!
    expect(c.unreadCount).toBe(0)
    expect(c.lastMessage?.id).toBe('m2')
  })

  it('receiveMessage replaces a matching optimistic bubble in a loaded thread', () => {
    useChatStore.setState({
      conversations: [convo({ userId: 'friend', unreadCount: 0 })],
      threads: { friend: [msg({ id: 'temp', senderId: 'me', recipientId: 'friend', body: 'hello', pending: true })] },
      activeUserId: null,
    })
    useChatStore.getState().receiveMessage(msg({ id: 'real', senderId: 'me', recipientId: 'friend', body: 'hello' }))
    const t = useChatStore.getState().threads.friend
    expect(t).toHaveLength(1)
    expect(t[0].id).toBe('real')
    expect(t[0].pending).toBeUndefined()
  })

  it('receiveMessage dedupes a message id already in the thread', () => {
    useChatStore.setState({
      conversations: [convo({ userId: 'friend', unreadCount: 0 })],
      threads: { friend: [msg({ id: 'dup', senderId: 'friend', recipientId: 'me', body: 'hi' })] },
      activeUserId: null,
    })
    useChatStore.getState().receiveMessage(msg({ id: 'dup', senderId: 'friend', recipientId: 'me', body: 'hi' }))
    expect(useChatStore.getState().threads.friend).toHaveLength(1)
  })
})
