import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChatBubbleLeftRightIcon,
  PlusIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { Avatar } from '@/components/ui/Avatar'
import { CollapseIcon } from '@/components/common/CollapseIcon'
import { FriendPanel } from './FriendPanel'
import { useChatStore } from '@/stores/chatStore'
import { useFriendStore } from '@/stores/friendStore'
import { useUiStore, type SocialTab } from '@/stores/uiStore'
import { cn } from '@/utils/cn'
import { parseShare } from '@/utils/chatShare'
import { useMediaQuery } from '@/hooks/useMediaQuery'

const RIGHT_RAIL_KEY = 'ns-nowplaying-width'
const RIGHT_RAIL_DEFAULT = 320
const RIGHT_RAIL_MIN = 280
const RIGHT_RAIL_MAX = 460

function getInitialRailWidth() {
  if (typeof window === 'undefined') return RIGHT_RAIL_DEFAULT
  const stored = Number(window.localStorage.getItem(RIGHT_RAIL_KEY))
  if (!stored || Number.isNaN(stored)) return RIGHT_RAIL_DEFAULT
  return Math.min(Math.max(stored, RIGHT_RAIL_MIN), RIGHT_RAIL_MAX)
}

function SocialDragHandle({ onMouseDown }: { onMouseDown: (event: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="group absolute left-0 top-0 z-20 hidden h-full w-2 cursor-grab active:cursor-grabbing justify-center lg:flex"
      aria-hidden="true"
    >
      <div className="h-full w-px bg-transparent transition-colors group-hover:bg-secondary/60" />
    </div>
  )
}

const tabs: Array<{
  id: SocialTab
  label: string
  Icon: typeof ChatBubbleLeftRightIcon
}> = [
  { id: 'messages', label: 'Messages', Icon: ChatBubbleLeftRightIcon },
  { id: 'friends', label: 'Friends', Icon: UserGroupIcon },
]

function relativeTime(iso: string) {
  const elapsed = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(1, Math.floor(elapsed / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function messagePreview(body: string) {
  const shared = parseShare(body)
  if (!shared) return body
  if (shared.kind === 'track') return 'Shared a song'
  if (shared.kind === 'album') return 'Shared an album'
  if (shared.kind === 'jam') return 'Invited you to a Jam'
  return 'Shared a playlist'
}

function MessagesTab() {
  const navigate = useNavigate()
  const conversations = useChatStore((s) => s.conversations)
  const fetchConversations = useChatStore((s) => s.fetchConversations)
  const friends = useFriendStore((s) => s.friends)
  const activity = useFriendStore((s) => s.activity)
  const fetchFriends = useFriendStore((s) => s.fetchFriends)
  const setSocialPanelOpen = useUiStore((s) => s.setSocialPanelOpen)

  useEffect(() => {
    void fetchConversations()
    void fetchFriends()
  }, [fetchConversations, fetchFriends])

  const onlineIds = useMemo(
    () => new Set(activity.filter((item) => item.isOnline).map((item) => item.userId)),
    [activity],
  )
  const newChatFriends = friends.filter(
    (friend) => !conversations.some((conversation) => conversation.userId === friend.userId),
  )

  const openThread = (userId?: string) => {
    setSocialPanelOpen(false)
    navigate(userId ? `/messages?u=${userId}` : '/messages')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="spotify-scrollbar flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 && newChatFriends.length === 0 ? (
          <div className="flex flex-col items-center px-6 pt-10 text-center">
            <ChatBubbleLeftRightIcon className="mb-3 h-10 w-10 text-secondary" />
            <p className="text-sm font-bold text-primary">No conversations yet</p>
            <p className="mt-1 text-xs text-secondary">Add a friend, then say hello.</p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <button
              key={conversation.userId}
              type="button"
              onClick={() => openThread(conversation.userId)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-elevated"
            >
              <div className="relative shrink-0">
                <Avatar src={conversation.avatarUrl} alt={conversation.name} size="md" round />
                {onlineIds.has(conversation.userId) && (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-green-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-primary">{conversation.name}</p>
                  {conversation.lastMessage && (
                    <span className="shrink-0 text-[11px] text-secondary">
                      {relativeTime(conversation.lastMessage.sentAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-secondary">
                    {conversation.lastMessage ? messagePreview(conversation.lastMessage.body) : 'Say hi!'}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                      {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}

        {newChatFriends.length > 0 && (
          <>
            <p className="px-2 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-secondary">
              Start a chat
            </p>
            {newChatFriends.slice(0, 5).map((friend) => (
              <button
                key={friend.userId}
                type="button"
                onClick={() => openThread(friend.userId)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-elevated"
              >
                <Avatar src={friend.avatarUrl} alt={friend.name} size="sm" round />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">{friend.name}</span>
                <PlusIcon className="h-4 w-4 text-secondary" />
              </button>
            ))}
          </>
        )}
      </div>

      <div className="border-t border-secondary/10 p-3">
        <button
          type="button"
          onClick={() => openThread()}
          className="w-full rounded-full bg-primary px-4 py-2 text-sm font-bold text-page transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Open all messages
        </button>
      </div>
    </div>
  )
}

export function SocialPanel() {
  const activeTab = useUiStore((s) => s.socialPanelTab)
  const setActiveTab = useUiStore((s) => s.setSocialPanelTab)
  const setOpen = useUiStore((s) => s.setSocialPanelOpen)
  const isDesktopRail = useMediaQuery('(min-width: 1024px)')
  const unread = useChatStore((s) => s.conversations.reduce((sum, item) => sum + item.unreadCount, 0))
  const requests = useFriendStore((s) => s.requests.length)
  const [width, setWidth] = useState(getInitialRailWidth)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  useEffect(() => {
    window.localStorage.setItem(RIGHT_RAIL_KEY, String(width))
  }, [width])

  const onDragStart = (event: React.MouseEvent) => {
    event.preventDefault()
    dragRef.current = { startX: event.clientX, startW: width }
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (event: MouseEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startX - event.clientX
      setWidth(Math.min(Math.max(dragRef.current.startW + delta, RIGHT_RAIL_MIN), RIGHT_RAIL_MAX))
    }
    const onUp = () => setDragging(false)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  return (
    <aside
      style={isDesktopRail ? { width } : undefined}
      className={cn(
        'fixed inset-x-2 bottom-20 top-[4.5rem] z-40 flex flex-col overflow-hidden rounded-xl border border-secondary/10 bg-surface shadow-2xl md:left-auto md:w-96 lg:relative lg:inset-auto lg:z-auto lg:shrink-0 lg:rounded-xl lg:border-0 lg:shadow-none',
        !dragging && 'lg:transition-[width,opacity,transform] lg:duration-300 lg:ease-out',
      )}
    >
      <div className="flex items-center justify-between p-4 pb-2">
        <h2 className="text-base font-bold text-primary">Social</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full p-1 text-secondary transition-all hover:scale-110 hover:bg-elevated hover:text-primary active:scale-95"
          aria-label="Close social panel"
          title="Close social panel"
        >
          <CollapseIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-3 mb-2 grid grid-cols-2 rounded-lg bg-base/60 p-1">
        {tabs.map(({ id, label, Icon }) => {
          const badge = id === 'messages' ? unread : requests
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'relative flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-bold transition-colors',
                activeTab === id ? 'bg-elevated text-primary shadow-sm' : 'text-secondary hover:text-primary',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {badge > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === 'messages' && <MessagesTab />}
        {activeTab === 'friends' && <FriendPanel embedded onClose={() => setOpen(false)} />}
      </div>
      <SocialDragHandle onMouseDown={onDragStart} />
    </aside>
  )
}
