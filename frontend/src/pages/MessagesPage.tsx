import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PaperAirplaneIcon, ChatBubbleLeftRightIcon, CheckIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { useChatStore } from '@/stores/chatStore'
import { useFriendStore } from '@/stores/friendStore'
import { useAuthStore } from '@/stores/authStore'
import type { ChatMessage } from '@/types/chat'
import { parseShare } from '@/utils/chatShare'
import { SharedTrackBubble } from '@/components/chat/SharedTrackBubble'
import { SharedAlbumBubble } from '@/components/chat/SharedAlbumBubble'
import { SharedPlaylistBubble } from '@/components/chat/SharedPlaylistBubble'
import { SharedJamBubble } from '@/components/chat/SharedJamBubble'
import { cn } from '@/utils/cn'

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

/** WhatsApp-style ✓ (sent) / ✓✓ (read) ticks on my own bubbles. */
function ReadTicks({ message }: { message: ChatMessage }) {
  if (message.pending) {
    return <span className="ml-1 inline-block h-3 w-3 rounded-full border border-white/50" aria-label="Sending" />
  }
  return (
    <span className={cn('ml-1 inline-flex', message.readAt ? 'text-white' : 'text-white/50')} aria-label={message.readAt ? 'Read' : 'Sent'}>
      <CheckIcon className="h-3.5 w-3.5" />
      {message.readAt && <CheckIcon className="-ml-2 h-3.5 w-3.5" />}
    </span>
  )
}

export function MessagesPage() {
  const me = useAuthStore((s) => s.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const conversations = useChatStore((s) => s.conversations)
  const threads = useChatStore((s) => s.threads)
  const activeUserId = useChatStore((s) => s.activeUserId)
  const isLoading = useChatStore((s) => s.isLoading)
  const { fetchConversations, openThread, closeThread, sendMessage, loadOlder, markRead } = useChatStore()
  const friends = useFriendStore((s) => s.friends)
  const friendsLoaded = useFriendStore((s) => s.friendsLoaded)
  const activity = useFriendStore((s) => s.activity)
  const fetchFriends = useFriendStore((s) => s.fetchFriends)

  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetchConversations()
    fetchFriends()
  }, [fetchConversations, fetchFriends])

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

  const thread = activeUserId ? (threads[activeUserId] ?? []) : []

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [activeUserId, thread.length])

  const onlineIds = useMemo(
    () => new Set(activity.filter((a) => a.isOnline).map((a) => a.userId)),
    [activity],
  )

  // Friends I have no conversation with yet — shown so a first chat can be started.
  const newChatFriends = useMemo(
    () => friends.filter((f) => !conversations.some((c) => c.userId === f.userId)),
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeUserId || !draft.trim() || chatLocked) return
    sendMessage(activeUserId, draft)
    setDraft('')
  }

  if (!me) return null

  return (
    <div className="flex h-full min-h-0 bg-page text-primary">
      {/* ── Conversation list ─────────────────────────────────────────── */}
      <aside className="flex w-full max-w-xs shrink-0 flex-col border-r border-elevated/40 bg-sidebar sm:w-80">
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

          {conversations.map((c) => (
            <button
              key={c.userId}
              onClick={() => select(c.userId)}
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
                    <span className="shrink-0 text-[11px] text-secondary">{formatTime(c.lastMessage.sentAt)}</span>
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
                  {c.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
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
      </aside>

      {/* ── Thread ────────────────────────────────────────────────────── */}
      <section className="flex min-w-0 flex-1 flex-col bg-page">
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
                                ticks={mine ? <ReadTicks message={m} /> : null}
                              />
                            ) : share.kind === 'album' ? (
                              <SharedAlbumBubble
                                albumId={share.id}
                                mine={mine}
                                time={formatTime(m.sentAt)}
                                ticks={mine ? <ReadTicks message={m} /> : null}
                              />
                            ) : share.kind === 'playlist' ? (
                              <SharedPlaylistBubble
                                playlistId={share.id}
                                mine={mine}
                                time={formatTime(m.sentAt)}
                                ticks={mine ? <ReadTicks message={m} /> : null}
                              />
                            ) : (
                              <SharedJamBubble
                                hostId={share.id}
                                hostName={share.name ?? 'your friend'}
                                mine={mine}
                                time={formatTime(m.sentAt)}
                                ticks={mine ? <ReadTicks message={m} /> : null}
                              />
                            )
                          ) : (
                            <div
                              className={cn(
                                'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words',
                                mine
                                  ? 'rounded-br-md bg-accent text-white'
                                  : 'rounded-bl-md bg-elevated text-primary',
                              )}
                            >
                              <span className="whitespace-pre-wrap">{m.body}</span>
                              <span
                                className={cn(
                                  'ml-2 inline-flex translate-y-0.5 items-center text-[10px]',
                                  mine ? 'text-white/70' : 'text-secondary',
                                )}
                              >
                                {formatTime(m.sentAt)}
                                {mine && <ReadTicks message={m} />}
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
              <form onSubmit={submit} className="flex items-center gap-2 border-t border-elevated/40 px-4 py-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Message ${activePartner.name}`}
                  maxLength={4000}
                  className="h-11 flex-1 rounded-full border border-transparent bg-elevated px-4 text-sm text-primary outline-none transition-colors placeholder:text-muted focus:border-accent/60"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                  aria-label="Send"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  )
}
