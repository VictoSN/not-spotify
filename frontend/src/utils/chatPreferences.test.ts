import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/stores/authStore'
import type { ChatMessage, Conversation } from '@/types/chat'
import {
  applyChatPreferences,
  clearChatOnDevice,
  deleteChatOnDevice,
  filterThreadForDevice,
  isChatDeletedOnDevice,
} from './chatPreferences'

const oldMessage: ChatMessage = {
  id: 'old',
  senderId: 'friend',
  recipientId: 'me',
  body: 'old message',
  sentAt: '2026-06-30T10:00:00.000Z',
  deliveredAt: null,
  readAt: null,
}

const newMessage: ChatMessage = {
  ...oldMessage,
  id: 'new',
  body: 'new message',
  sentAt: '2026-06-30T12:00:00.000Z',
}

const conversation = (lastMessage: ChatMessage = oldMessage): Conversation => ({
  userId: 'friend',
  name: 'Friend',
  avatarUrl: null,
  lastMessage,
  unreadCount: 3,
})

beforeEach(() => {
  window.localStorage.clear()
  useAuthStore.setState({ user: { id: 'me' } as never, isAuthenticated: true })
})

describe('chat device preferences', () => {
  it('clears existing history while preserving an empty conversation row', () => {
    clearChatOnDevice('friend', '2026-06-30T11:00:00.000Z')

    expect(filterThreadForDevice('friend', [oldMessage, newMessage])).toEqual([newMessage])
    expect(applyChatPreferences([conversation()])).toEqual([
      { ...conversation(), lastMessage: null, unreadCount: 0 },
    ])
    expect(isChatDeletedOnDevice('friend')).toBe(false)
  })

  it('deletes the old conversation but lets a genuinely new message restore it', () => {
    deleteChatOnDevice('friend', '2026-06-30T11:00:00.000Z')

    expect(applyChatPreferences([conversation(oldMessage)])).toEqual([])
    expect(applyChatPreferences([conversation(newMessage)])).toEqual([conversation(newMessage)])
    expect(isChatDeletedOnDevice('friend')).toBe(true)
  })

  it('keeps clear/delete history scoped to the signed-in account', () => {
    deleteChatOnDevice('friend', '2026-06-30T11:00:00.000Z')
    useAuthStore.setState({ user: { id: 'someone-else' } as never, isAuthenticated: true })

    expect(isChatDeletedOnDevice('friend')).toBe(false)
    expect(applyChatPreferences([conversation()])).toEqual([conversation()])
  })
})
