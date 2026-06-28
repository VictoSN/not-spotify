import React, { act } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MessagesPage } from './MessagesPage'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'
import { useFriendStore } from '@/stores/friendStore'
import type { ChatMessage, Conversation } from '@/types/chat'
import type { Friend } from '@/types/friend'

const PARTNER = 'partner-1'

const message: ChatMessage = {
  id: 'm1',
  senderId: PARTNER,
  recipientId: 'me',
  body: 'hey there',
  sentAt: '2026-06-29T10:00:00Z',
  readAt: null,
}

const conversation: Conversation = {
  userId: PARTNER,
  name: 'Old Friend',
  avatarUrl: null,
  lastMessage: message,
  unreadCount: 0,
}

const friend: Friend = { userId: PARTNER, name: 'Old Friend', avatarUrl: null, mutualFriendsCount: 0 }

// The page's mount effects refetch via these services, so we drive the scenario
// through the mocks rather than seeding store state (which would be overwritten).
const chatServiceMock = vi.hoisted(() => ({
  getConversations: vi.fn(),
  getThread: vi.fn(),
  send: vi.fn(() => Promise.resolve()),
  markRead: vi.fn(() => Promise.resolve()),
}))
const friendServiceMock = vi.hoisted(() => ({
  getFriends: vi.fn(),
  getActivity: vi.fn(() => Promise.resolve([])),
}))

vi.mock('@/services/chatService', () => ({ chatService: chatServiceMock }))
vi.mock('@/services/friendService', () => ({ friendService: friendServiceMock }))

async function renderThread() {
  const result = render(
    <MemoryRouter initialEntries={[`/messages?u=${PARTNER}`]}>
      <Routes>
        <Route path="/messages" element={<MessagesPage />} />
      </Routes>
    </MemoryRouter>,
  )
  // Flush the mount effects (fetchConversations / fetchFriends / openThread).
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
  return result
}

describe('MessagesPage chat lock after unfriending (bug 28)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom has no scrollIntoView; the page auto-scrolls to the newest message.
    Element.prototype.scrollIntoView = vi.fn()
    chatServiceMock.getConversations.mockResolvedValue([conversation])
    chatServiceMock.getThread.mockResolvedValue([message])
    act(() => {
      useAuthStore.setState({ isAuthenticated: true, user: { id: 'me', name: 'Me' } as never })
      useChatStore.setState({ conversations: [], threads: {}, activeUserId: null, isLoading: false } as never)
      useFriendStore.setState({ friends: [], friendsLoaded: false } as never)
    })
  })

  afterEach(() => {
    act(() => {
      useChatStore.setState({ conversations: [], threads: {}, activeUserId: null } as never)
      useFriendStore.setState({ friends: [], friendsLoaded: false } as never)
    })
  })

  it('shows the composer while the partner is still a friend', async () => {
    friendServiceMock.getFriends.mockResolvedValue([friend])
    await renderThread()

    expect(screen.getByPlaceholderText('Message Old Friend')).toBeInTheDocument()
    expect(screen.queryByText(/no longer friends/i)).not.toBeInTheDocument()
  })

  it('locks the chat and shows a disclaimer once unfriended', async () => {
    // Friends list loads without the partner → unfriended.
    friendServiceMock.getFriends.mockResolvedValue([])
    await renderThread()

    expect(screen.queryByPlaceholderText('Message Old Friend')).not.toBeInTheDocument()
    expect(screen.getByText(/no longer friends with Old Friend/i)).toBeInTheDocument()
    // History stays visible — only sending is blocked (appears in both the
    // conversation preview and the thread bubble).
    expect(screen.getAllByText('hey there').length).toBeGreaterThan(0)
  })

  it('does not flash the lock before the friends list has loaded', async () => {
    // getFriends never resolves → friendsLoaded stays false, verdict withheld.
    friendServiceMock.getFriends.mockReturnValue(new Promise(() => {}))
    await renderThread()

    expect(screen.queryByText(/no longer friends/i)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Message Old Friend')).toBeInTheDocument()
  })
})
