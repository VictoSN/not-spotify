import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import {
  PaperAirplaneIcon,
  ArrowLeftIcon,
  ChatBubbleLeftRightIcon,
  LockClosedIcon,
  MinusCircleIcon,
  PlusIcon,
  FaceSmileIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { DocumentIcon, PhotoIcon } from '@heroicons/react/24/solid'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { useChatStore } from '@/stores/chatStore'
import { useFriendStore } from '@/stores/friendStore'
import { useAuthStore } from '@/stores/authStore'
import type { ChatMessage, Conversation } from '@/types/chat'
import { parseShare } from '@/utils/chatShare'
import { SharedTrackBubble } from '@/components/chat/SharedTrackBubble'
import { SharedAlbumBubble } from '@/components/chat/SharedAlbumBubble'
import { SharedPlaylistBubble } from '@/components/chat/SharedPlaylistBubble'
import { SharedJamBubble } from '@/components/chat/SharedJamBubble'
import { MediaMenuItem, MediaMenuShell } from '@/components/cards/MediaMenuShell'
import { PinIcon } from '@/components/cards/PinMenuItem'
import { cn } from '@/utils/cn'
import { getPinnedKeys, isPinned, PINNED_EVENT, togglePinned } from '@/utils/pinnedLibrary'
import { isChatDeletedOnDevice } from '@/utils/chatPreferences'
import type { PointerMenuHandle } from '@/utils/contextMenu'
import { useConfirm } from '@/hooks/useConfirm'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatDay(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const QUICK_EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '😭', '😡', '👍', '👏', '🙏', '❤️', '🔥', '🎉', '✨', '🎵', '🤝']

interface ChatThreadMenuHandle {
  openFor: (conversation: Conversation, x: number, y: number) => void
}

/** Sent (one grey), delivered (two grey), and read (two blue) message receipts. */
export function MessageStatusTicks({ message }: { message: ChatMessage }) {
  if (message.pending) {
    return <span className="chat-meta-outgoing ml-1 inline-block h-3 w-3 rounded-full border border-current" aria-label="Sending" />
  }

  const read = Boolean(message.readAt)
  const delivered = read || Boolean(message.deliveredAt)
  return (
    <span
      className={cn(
        'ml-1 inline-flex h-3.5 w-[18px] shrink-0 translate-y-px items-center justify-center',
        read ? 'text-[#53bdeb]' : 'chat-meta-outgoing',
      )}
      aria-label={read ? 'Read' : delivered ? 'Delivered' : 'Sent'}
    >
      <svg viewBox="0 0 18 14" aria-hidden="true" className="h-3.5 w-[18px]" fill="none">
        {delivered && (
          <path d="m1.2 7.5 3.1 3 6.2-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        )}
        <path d={delivered ? 'm6.1 7.5 3.1 3 6.2-7' : 'm4.3 7.5 3.1 3 6.2-7'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function MessagesPage() {
  const confirm = useConfirm()
  const me = useAuthStore((s) => s.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const conversations = useChatStore((s) => s.conversations)
  const threads = useChatStore((s) => s.threads)
  const activeUserId = useChatStore((s) => s.activeUserId)
  const isLoading = useChatStore((s) => s.isLoading)
  const {
    fetchConversations,
    openThread,
    closeThread,
    sendMessage,
    loadOlder,
    markRead,
    clearChat,
    deleteChat,
  } = useChatStore()
  const friends = useFriendStore((s) => s.friends)
  const friendsLoaded = useFriendStore((s) => s.friendsLoaded)
  const activity = useFriendStore((s) => s.activity)
  const fetchFriends = useFriendStore((s) => s.fetchFriends)

  const [draft, setDraft] = useState('')
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false)
  const [emojiMenuOpen, setEmojiMenuOpen] = useState(false)
  const [pinRevision, setPinRevision] = useState(0)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const threadTouchStartRef = useRef<{ x: number; y: number } | null>(null)
  const composerToolsRef = useRef<HTMLDivElement | null>(null)
  const documentInputRef = useRef<HTMLInputElement | null>(null)
  const mediaInputRef = useRef<HTMLInputElement | null>(null)
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null)
  const chatMenuRef = useRef<ChatThreadMenuHandle | null>(null)

  useEffect(() => {
    fetchConversations()
    fetchFriends()
  }, [fetchConversations, fetchFriends])

  useEffect(() => {
    const syncPins = () => setPinRevision((revision) => revision + 1)
    window.addEventListener(PINNED_EVENT, syncPins)
    window.addEventListener('storage', syncPins)
    return () => {
      window.removeEventListener(PINNED_EVENT, syncPins)
      window.removeEventListener('storage', syncPins)
    }
  }, [])

  // Deep link: /messages?u=<friendId> opens that thread.
  const deepLink = searchParams.get('u')
  useEffect(() => {
    if (deepLink) openThread(deepLink)
    return () => closeThread()
  }, [deepLink, openThread, closeThread])

  // Messages that arrived while the tab was hidden badge up; coming back to
  // the tab with this thread open means they're read now — clear immediately.
  useEffect(() => {
    if (!activeUserId) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') markRead(activeUserId)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [activeUserId, markRead])

  useEffect(() => {
    const closePopovers = (event: PointerEvent) => {
      if (!composerToolsRef.current?.contains(event.target as Node)) {
        setAttachmentMenuOpen(false)
        setEmojiMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', closePopovers)
    return () => document.removeEventListener('pointerdown', closePopovers)
  }, [])

  const thread = activeUserId ? (threads[activeUserId] ?? []) : []

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [activeUserId, thread.length])

  const onlineIds = useMemo(
    () => new Set(activity.filter((a) => a.isOnline).map((a) => a.userId)),
    [activity],
  )

  const sortedConversations = useMemo(() => {
    const pinRank = new Map(
      getPinnedKeys()
        .filter((key) => key.startsWith('chat-'))
        .map((key, index) => [key.slice(5), index]),
    )
    return conversations
      .map((conversation, index) => ({ conversation, index }))
      .sort((left, right) => {
        const leftRank = pinRank.get(left.conversation.userId)
        const rightRank = pinRank.get(right.conversation.userId)
        if (leftRank !== undefined || rightRank !== undefined) {
          if (leftRank === undefined) return 1
          if (rightRank === undefined) return -1
          return leftRank - rightRank
        }
        return left.index - right.index
      })
      .map(({ conversation }) => conversation)
  }, [conversations, pinRevision])

  // Friends I have no conversation with yet — shown so a first chat can be started.
  const newChatFriends = useMemo(
    () => friends.filter(
      (friend) => !conversations.some((conversation) => conversation.userId === friend.userId)
        && !isChatDeletedOnDevice(friend.userId),
    ),
    [friends, conversations],
  )

  const activePartner =
    conversations.find((c) => c.userId === activeUserId) ??
    (activeUserId
      ? (() => {
          const f = friends.find((fr) => fr.userId === activeUserId)
          return f ? { userId: f.userId, name: f.name, avatarUrl: f.avatarUrl, lastMessage: null, unreadCount: 0 } : null
        })()
      : null)

  // Bug 28: once a friendship ends, the conversation history stays visible but the
  // chat is locked — no sending. We only trust this verdict after the friends list
  // has actually loaded, so a real friend never flashes "unfriended" on first paint.
  const isFriend = activeUserId ? friends.some((f) => f.userId === activeUserId) : false
  const chatLocked = Boolean(activeUserId) && friendsLoaded && !isFriend

  const select = (userId: string) => {
    setSearchParams({ u: userId }, { replace: true })
  }

  const showConversationList = () => {
    setSearchParams({}, { replace: true })
  }

  const handleThreadTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) return
    const touch = event.touches[0]
    threadTouchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleThreadTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = threadTouchStartRef.current
    threadTouchStartRef.current = null
    if (!start || !window.matchMedia('(max-width: 767px)').matches) return

    const touch = event.changedTouches[0]
    if (!touch) return
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y

    // A deliberate horizontal swipe to the left returns to the conversation list.
    // Vertical scrolling and short taps stay untouched.
    if (deltaX < -72 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      showConversationList()
    }
  }

  const handleClearChat = async (conversation: Conversation) => {
    const accepted = await confirm({
      title: `Clear chat with ${conversation.name}?`,
      message: 'This removes every message from this device but keeps the empty chat in your list.',
      confirmText: 'Clear chat',
      danger: true,
    })
    if (accepted) clearChat(conversation.userId)
  }

  const handleDeleteChat = async (conversation: Conversation) => {
    const accepted = await confirm({
      title: `Delete chat with ${conversation.name}?`,
      message: 'This removes the conversation and its message history from this device.',
      confirmText: 'Delete chat',
      danger: true,
    })
    if (!accepted) return
    deleteChat(conversation.userId)
    if (activeUserId === conversation.userId) setSearchParams({}, { replace: true })
  }

  const sendDraft = () => {
    if (!activeUserId || !draft.trim() || chatLocked) return
    sendMessage(activeUserId, draft)
    setDraft('')
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    sendDraft()
  }

  const handleDraftKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    sendDraft()
  }

  useEffect(() => {
    const input = draftInputRef.current
    if (!input) return
    input.style.height = '0px'
    input.style.height = `${Math.min(input.scrollHeight, 96)}px`
  }, [draft])

  const insertEmoji = (emoji: string) => {
    const input = draftInputRef.current
    const start = input?.selectionStart ?? draft.length
    const end = input?.selectionEnd ?? start
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`
    setDraft(next)
    setEmojiMenuOpen(false)
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  if (!me) return null

  return (
    <div className="flex h-full min-h-0 bg-page text-primary">
      {/* ── Conversation list ─────────────────────────────────────────── */}
      <aside
        className={cn(
          'w-full shrink-0 flex-col border-r border-elevated/40 bg-sidebar md:flex md:w-80',
          activeUserId ? 'hidden' : 'flex',
        )}
      >
        <div className="px-4 pb-3 pt-5">
          <h1 className="text-2xl font-bold text-primary">Messages</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {conversations.length === 0 && newChatFriends.length === 0 && (
            <div className="px-3 py-10 text-center">
              <ChatBubbleLeftRightIcon className="mx-auto mb-3 h-10 w-10 text-muted" />
              <p className="text-sm font-semibold text-primary">No conversations yet</p>
              <p className="mt-1 text-xs text-secondary">Add some friends and their chats will appear here.</p>
            </div>
          )}

          {sortedConversations.map((c) => (
            <button
              key={c.userId}
              onClick={() => select(c.userId)}
              aria-label={`Open chat with ${c.name}`}
              onContextMenu={(event) => {
                event.preventDefault()
                chatMenuRef.current?.openFor(c, event.clientX, event.clientY)
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-md p-2.5 text-left transition-colors',
                activeUserId === c.userId ? 'bg-elevated' : 'hover:bg-elevated/50',
              )}
            >
              <div className="relative shrink-0">
                <Avatar src={c.avatarUrl} alt={c.name} size="lg" round />
                {onlineIds.has(c.userId) && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-sidebar bg-accent" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-primary">{c.name}</p>
                  {c.lastMessage && (
                    <time
                      dateTime={c.lastMessage.sentAt}
                      className={cn(
                        'shrink-0 text-[11px]',
                        c.unreadCount > 0 ? 'font-bold text-primary' : 'font-normal text-secondary',
                      )}
                    >
                      {formatTime(c.lastMessage.sentAt)}
                    </time>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-secondary">
                    {c.lastMessage
                      ? `${c.lastMessage.senderId === me.id ? 'You: ' : ''}${
                          (() => {
                            const s = parseShare(c.lastMessage.body)
                            if (!s) return c.lastMessage.body
                            if (s.kind === 'track') return '🎵 Shared a song'
                            if (s.kind === 'album') return '💿 Shared an album'
                            if (s.kind === 'jam') return '👥 Invited you to a Jam'
                            return '📃 Shared a playlist'
                          })()
                        }`
                      : 'Say hi!'}
                  </p>
                  {isPinned(`chat-${c.userId}`) && (
                    <PinIcon className="h-3.5 w-3.5 shrink-0 text-accent" />
                  )}
                  {c.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-black">
                      {c.unreadCount > 99 ? '99+' : c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}

          {newChatFriends.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-4 text-xs font-bold uppercase tracking-wider text-secondary">Start a chat</p>
              {newChatFriends.map((f) => (
                <button
                  key={f.userId}
                  onClick={() => select(f.userId)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md p-2.5 text-left transition-colors',
                    activeUserId === f.userId ? 'bg-elevated' : 'hover:bg-elevated/50',
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar src={f.avatarUrl} alt={f.name} size="lg" round />
                    {onlineIds.has(f.userId) && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-sidebar bg-accent" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary">{f.name}</p>
                    <p className="text-xs text-secondary">Friend · no messages yet</p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
        <ChatThreadContextMenu
          ref={chatMenuRef}
          onClear={handleClearChat}
          onDelete={handleDeleteChat}
        />
      </aside>

      {/* ── Thread ────────────────────────────────────────────────────── */}
      <section
        onTouchStart={handleThreadTouchStart}
        onTouchEnd={handleThreadTouchEnd}
        onTouchCancel={() => { threadTouchStartRef.current = null }}
        className={cn(
          'min-w-0 flex-1 flex-col bg-page md:flex',
          activeUserId ? 'flex' : 'hidden',
        )}
      >
        {!activePartner ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ChatBubbleLeftRightIcon className="h-14 w-14 text-muted" />
            <p className="text-lg font-bold text-primary">Your messages</p>
            <p className="max-w-xs text-sm text-secondary">
              Pick a friend on the left to start chatting in real time.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-elevated/40 bg-page px-4 py-3">
              <button
                type="button"
                onClick={showConversationList}
                className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-elevated hover:text-primary md:hidden"
                aria-label="Back to conversations"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <Link
                to={`/user/${activePartner.userId}`}
                className="group flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                aria-label={`View ${activePartner.name}'s profile`}
              >
                <div className="relative">
                  <Avatar src={activePartner.avatarUrl} alt={activePartner.name} size="md" round />
                  {onlineIds.has(activePartner.userId) && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-page bg-accent" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-primary group-hover:underline">{activePartner.name}</p>
                  <p className="text-xs text-secondary">{onlineIds.has(activePartner.userId) ? 'Online' : 'Offline'}</p>
                </div>
              </Link>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {isLoading && thread.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner size="md" />
                </div>
              ) : (
                <>
                  {thread.length >= 50 && (
                    <div className="mb-3 text-center">
                      <button
                        onClick={() => activeUserId && loadOlder(activeUserId)}
                        className="rounded-full bg-elevated px-4 py-1.5 text-xs font-semibold text-secondary transition-all hover:scale-105 hover:text-primary"
                      >
                        Load older messages
                      </button>
                    </div>
                  )}

                  {thread.map((m, i) => {
                    const mine = m.senderId === me.id
                    const showDay = i === 0 || formatDay(thread[i - 1].sentAt) !== formatDay(m.sentAt)
                    const share = parseShare(m.body)
                    return (
                      <div key={m.id}>
                        {showDay && (
                          <div className="my-4 flex items-center justify-center">
                            <span className="rounded-full bg-elevated px-3 py-1 text-[11px] font-semibold text-secondary">
                              {formatDay(m.sentAt)}
                            </span>
                          </div>
                        )}
                        <div className={cn('mb-1.5 flex', mine ? 'justify-end' : 'justify-start')}>
                          {share ? (
                            share.kind === 'track' ? (
                              <SharedTrackBubble
                                trackId={share.id}
                                mine={mine}
                                time={formatTime(m.sentAt)}
                                ticks={mine ? <MessageStatusTicks message={m} /> : null}
                              />
                            ) : share.kind === 'album' ? (
                              <SharedAlbumBubble
                                albumId={share.id}
                                mine={mine}
                                time={formatTime(m.sentAt)}
                                ticks={mine ? <MessageStatusTicks message={m} /> : null}
                              />
                            ) : share.kind === 'playlist' ? (
                              <SharedPlaylistBubble
                                playlistId={share.id}
                                mine={mine}
                                time={formatTime(m.sentAt)}
                                ticks={mine ? <MessageStatusTicks message={m} /> : null}
                              />
                            ) : (
                              <SharedJamBubble
                                hostId={share.id}
                                hostName={share.name ?? 'your friend'}
                                mine={mine}
                                time={formatTime(m.sentAt)}
                                ticks={mine ? <MessageStatusTicks message={m} /> : null}
                              />
                            )
                          ) : (
                            <div
                              className={cn(
                                'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words',
                                mine
                                  ? 'chat-bubble-outgoing rounded-br-md'
                                  : 'chat-bubble-incoming rounded-bl-md',
                              )}
                            >
                              <span className="whitespace-pre-wrap">{m.body}</span>
                              <span
                                className={cn(
                                  'ml-2 inline-flex translate-y-0.5 items-center text-[10px]',
                                  mine ? 'chat-meta-outgoing' : 'chat-meta-incoming',
                                )}
                              >
                                {formatTime(m.sentAt)}
                                {mine && <MessageStatusTicks message={m} />}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Composer — locked once the friendship ends (bug 28) */}
            {chatLocked ? (
              <div
                role="alert"
                className="flex items-center justify-center gap-2.5 border-t border-elevated/40 bg-elevated/30 px-4 py-4 text-center"
              >
                <LockClosedIcon className="h-4 w-4 shrink-0 text-secondary" />
                <p className="text-sm text-secondary">
                  You&rsquo;re no longer friends with {activePartner.name}. You cannot send messages unless you add them again.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="border-t border-elevated/40 px-4 py-3">
                <div
                  ref={composerToolsRef}
                  className="relative flex min-h-11 w-full min-w-0 items-end rounded-[22px] border border-transparent bg-elevated px-1.5 transition-colors focus-within:border-accent/60"
                >
                  <input ref={documentInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.zip" className="hidden" />
                  <input ref={mediaInputRef} type="file" accept="image/*,video/*" className="hidden" />

                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentMenuOpen((open) => !open)
                      setEmojiMenuOpen(false)
                    }}
                    className={cn(
                      'mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary transition-all duration-200 hover:scale-110 hover:bg-primary/10 hover:text-primary active:scale-90',
                      attachmentMenuOpen && 'rotate-45 bg-primary/10 text-primary',
                    )}
                    aria-label="Add attachment"
                    aria-haspopup="menu"
                    aria-expanded={attachmentMenuOpen}
                  >
                    <PlusIcon className="h-5 w-5 stroke-2" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmojiMenuOpen((open) => !open)
                      setAttachmentMenuOpen(false)
                    }}
                    className={cn(
                      'mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary transition-all duration-200 hover:scale-110 hover:bg-primary/10 hover:text-primary active:scale-90',
                      emojiMenuOpen && 'bg-primary/10 text-primary',
                    )}
                    aria-label="Choose emoji"
                    aria-haspopup="dialog"
                    aria-expanded={emojiMenuOpen}
                  >
                    <FaceSmileIcon className="h-5 w-5 stroke-2" />
                  </button>

                  {attachmentMenuOpen && (
                    <div
                      role="menu"
                      aria-label="Attachment options"
                      className="absolute bottom-[calc(100%+0.75rem)] left-0 z-50 w-44 overflow-hidden rounded-2xl bg-[#292929] py-1.5 text-sm text-white shadow-2xl ring-1 ring-white/10"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAttachmentMenuOpen(false)
                          documentInputRef.current?.click()
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/10"
                      >
                        <DocumentIcon className="h-5 w-5 shrink-0 text-violet-500" />
                        <span>Document</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAttachmentMenuOpen(false)
                          mediaInputRef.current?.click()
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/10"
                      >
                        <PhotoIcon className="h-5 w-5 shrink-0 text-blue-400" />
                        <span>Photos &amp; videos</span>
                      </button>
                    </div>
                  )}

                  {emojiMenuOpen && (
                    <div
                      role="dialog"
                      aria-label="Emoji picker"
                      className="absolute bottom-[calc(100%+0.75rem)] left-10 z-50 w-56 rounded-2xl bg-[#292929] p-3 shadow-2xl ring-1 ring-white/10"
                    >
                      <div className="grid grid-cols-8 gap-1">
                        {QUICK_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-lg transition-all hover:scale-125 hover:bg-white/10 active:scale-95"
                            aria-label={`Insert ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <textarea
                    ref={draftInputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleDraftKeyDown}
                    placeholder={`Message ${activePartner.name}`}
                    maxLength={4000}
                    rows={1}
                    className="max-h-24 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-3 text-sm leading-5 text-primary outline-none placeholder:text-muted"
                  />
                  {draft.trim() && (
                    <button
                      type="submit"
                      className="mb-1 mr-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-black transition-all hover:scale-105 active:scale-95"
                      aria-label="Send"
                    >
                      <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  )
}

const ChatThreadContextMenu = forwardRef<
  ChatThreadMenuHandle,
  {
    onClear: (conversation: Conversation) => void
    onDelete: (conversation: Conversation) => void
  }
>(function ChatThreadContextMenu({ onClear, onDelete }, ref) {
  const pointerMenuRef = useRef<PointerMenuHandle | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const pinKey = `chat-${conversation?.userId ?? 'none'}`
  const pinned = conversation ? isPinned(pinKey) : false

  useImperativeHandle(ref, () => ({
    openFor: (nextConversation, x, y) => {
      flushSync(() => setConversation(nextConversation))
      pointerMenuRef.current?.openAt(x, y)
    },
  }), [])

  return (
    <MediaMenuShell
      ref={pointerMenuRef}
      ariaLabel={conversation ? `Chat options for ${conversation.name}` : 'Chat options'}
      triggerClassName="hidden"
      panelClassName="w-52!"
    >
      {(close) => conversation && (
        <>
          <MediaMenuItem
            icon={<PinIcon className={pinned ? 'text-accent' : ''} />}
            label={pinned ? 'Unpin chat' : 'Pin chat'}
            onClick={() => {
              togglePinned(pinKey)
              close()
            }}
          />
          <MediaMenuItem
            icon={<MinusCircleIcon />}
            label="Clear chat"
            onClick={() => {
              close()
              void onClear(conversation)
            }}
          />
          <MediaMenuItem
            icon={<TrashIcon />}
            label="Delete chat"
            onClick={() => {
              close()
              void onDelete(conversation)
            }}
          />
        </>
      )}
    </MediaMenuShell>
  )
})
