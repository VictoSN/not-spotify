import React, { act } from 'react'
import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageStatusTicks, MessagesPage } from './MessagesPage'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'
import { useFriendStore } from '@/stores/friendStore'
import type { ChatMessage, Conversation } from '@/types/chat'
import type { Friend } from '@/types/friend'
import { ConfirmProvider } from '@/components/common/ConfirmDialog'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const PARTNER = 'partner-1'

const message: ChatMessage = {
  id: 'm1',
  senderId: PARTNER,
  recipientId: 'me',
  body: 'hey there',
  sentAt: '2026-06-29T10:00:00Z',
  deliveredAt: null,
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
  markDelivered: vi.fn(() => Promise.resolve()),
}))
const friendServiceMock = vi.hoisted(() => ({
  getFriends: vi.fn(),
  getActivity: vi.fn(() => Promise.resolve([])),
}))

vi.mock('@/services/chatService', () => ({ chatService: chatServiceMock }))
vi.mock('@/services/friendService', () => ({ friendService: friendServiceMock }))

async function renderMessages(initialEntry: string) {
  const result = render(
    <ConfirmProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/messages" element={<MessagesPage />} />
        </Routes>
      </MemoryRouter>
    </ConfirmProvider>,
  )
  // Flush the mount effects (fetchConversations / fetchFriends / openThread).
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
  return result
}

async function renderThread() {
  return renderMessages(`/messages?u=${PARTNER}`)
}

describe('MessagesPage chat lock after unfriending (bug 28)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
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

  it('uses the green unread badge and bolds only unread conversation times', async () => {
    const readConversation: Conversation = {
      ...conversation,
      userId: 'partner-2',
      name: 'Read Friend',
      lastMessage: { ...message, id: 'm2', senderId: 'partner-2', sentAt: '2026-06-29T11:00:00Z' },
    }
    chatServiceMock.getConversations.mockResolvedValue([
      { ...conversation, name: 'Unread Friend', unreadCount: 2 },
      readConversation,
    ])
    friendServiceMock.getFriends.mockResolvedValue([friend])

    await renderMessages('/messages')

    const unreadRow = screen.getByRole('button', { name: 'Open chat with Unread Friend' })
    expect(unreadRow.querySelector('time')).toHaveClass('font-bold', 'text-primary')
    expect(within(unreadRow).getByText('2')).toHaveClass('bg-accent', 'text-black')

    const readRow = screen.getByRole('button', { name: 'Open chat with Read Friend' })
    expect(readRow.querySelector('time')).toHaveClass('font-normal', 'text-secondary')
    expect(readRow.querySelector('time')).not.toHaveClass('font-bold')
  })

  it('opens the attachment menu and inserts an emoji from the left composer controls', async () => {
    friendServiceMock.getFriends.mockResolvedValue([friend])
    await renderThread()

    fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }))
    expect(screen.getByRole('menu', { name: 'Attachment options' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Document' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Photos & videos' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Choose emoji' }))
    expect(screen.queryByRole('menu', { name: 'Attachment options' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Insert 😀' }))
    expect(screen.getByPlaceholderText('Message Old Friend')).toHaveValue('😀')
  })

  it('shows the send button inside the composer only when text is entered', async () => {
    friendServiceMock.getFriends.mockResolvedValue([friend])
    await renderThread()

    const composer = screen.getByPlaceholderText('Message Old Friend')
    const composerBox = composer.parentElement
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()

    fireEvent.change(composer, { target: { value: 'Hello' } })

    const send = screen.getByRole('button', { name: 'Send' })
    expect(composerBox).toContainElement(send)

    fireEvent.change(composer, { target: { value: '' } })
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()
  })

  it('keeps Shift+Enter for a new line and sends with Enter', async () => {
    friendServiceMock.getFriends.mockResolvedValue([friend])
    chatServiceMock.send.mockResolvedValue({
      ...message,
      id: 'sent-message',
      senderId: 'me',
      recipientId: PARTNER,
      body: 'first line\nsecond line',
    })
    await renderThread()

    const composer = screen.getByPlaceholderText('Message Old Friend')
    expect(composer.tagName).toBe('TEXTAREA')

    fireEvent.change(composer, { target: { value: 'first line' } })
    const shiftEnter = createEvent.keyDown(composer, { key: 'Enter', shiftKey: true })
    fireEvent(composer, shiftEnter)
    expect(shiftEnter.defaultPrevented).toBe(false)

    // jsdom does not perform the browser's native textarea line-break action.
    fireEvent.change(composer, { target: { value: 'first line\nsecond line' } })
    const enter = createEvent.keyDown(composer, { key: 'Enter' })
    fireEvent(composer, enter)

    expect(enter.defaultPrevented).toBe(true)
    await waitFor(() => expect(chatServiceMock.send).toHaveBeenCalledWith(PARTNER, 'first line\nsecond line'))
    expect(composer).toHaveValue('')
  })
  it('shows only pin, clear, and delete on a conversation right-click', async () => {
    friendServiceMock.getFriends.mockResolvedValue([friend])
    await renderThread()

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Open chat with Old Friend' }), {
      clientX: 80,
      clientY: 120,
    })

    const items = await screen.findAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual(['Pin chat', 'Clear chat', 'Delete chat'])

    const pinItem = screen.getByRole('menuitem', { name: 'Pin chat' })
    expect(pinItem.querySelector('path')).toHaveAttribute(
      'd',
      'M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134c.064.374.143.844.16 1.013.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0L5.94 10.768 2.757 13.95c-.195.195-.707.707-1.414 0-.707-.707-.195-1.219 0-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72.169.016.639.095 1.013.159L8.22 2.302c-.02-.125-.039-.283-.04-.46 0-.43.108-1.022.589-1.503a.5.5 0 0 1 .707 0z',
    )
    fireEvent.click(pinItem)
    expect(window.localStorage.getItem('ns-library-pinned:me')).toContain(`chat-${PARTNER}`)
  })

  it('clear chat removes every bubble but preserves an empty conversation row', async () => {
    friendServiceMock.getFriends.mockResolvedValue([friend])
    await renderThread()

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Open chat with Old Friend' }), {
      clientX: 80,
      clientY: 120,
    })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Clear chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear chat' }))

    await waitFor(() => expect(screen.queryByText('hey there')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Open chat with Old Friend' })).toBeInTheDocument()
    expect(screen.getByText('Say hi!')).toBeInTheDocument()
  })

  it('delete chat removes the conversation and its history from the list', async () => {
    friendServiceMock.getFriends.mockResolvedValue([friend])
    await renderThread()

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Open chat with Old Friend' }), {
      clientX: 80,
      clientY: 120,
    })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete chat' }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Open chat with Old Friend' })).not.toBeInTheDocument()
    })
    expect(screen.queryByText('hey there')).not.toBeInTheDocument()
    expect(screen.getByText('No conversations yet')).toBeInTheDocument()
  })
})

describe('MessageStatusTicks', () => {
  const outbound = (overrides: Partial<ChatMessage>): ChatMessage => ({
    id: 'outbound',
    senderId: 'me',
    recipientId: PARTNER,
    body: 'hello',
    sentAt: '2026-06-29T10:00:00Z',
    deliveredAt: null,
    readAt: null,
    ...overrides,
  })

  it.each([
    ['Sent', outbound({}), 1, false],
    ['Delivered', outbound({ deliveredAt: '2026-06-29T10:00:01Z' }), 2, false],
    ['Read', outbound({ deliveredAt: '2026-06-29T10:00:01Z', readAt: '2026-06-29T10:00:02Z' }), 2, true],
  ] as const)('renders %s with the correct check count and color', (label, statusMessage, pathCount, blue) => {
    const { container } = render(<MessageStatusTicks message={statusMessage} />)
    const receipt = screen.getByLabelText(label)
    expect(container.querySelectorAll('path')).toHaveLength(pathCount)
    expect(receipt).toHaveClass(blue ? 'text-[#53bdeb]' : 'chat-meta-outgoing')
  })
})
