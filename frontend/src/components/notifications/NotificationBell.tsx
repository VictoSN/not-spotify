import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellIcon, UserPlusIcon, CheckCircleIcon, XCircleIcon, MusicalNoteIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { BellIcon as BellSolid } from '@heroicons/react/24/solid'
import { useNotificationStore } from '@/stores/notificationStore'
import { useChatStore } from '@/stores/chatStore'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import type { AppNotification } from '@/types/notification'
import { cn } from '@/utils/cn'

const JAM_USER_LINK = /^\/user\/([0-9a-f-]{36})/i

function NotificationIcon({ type }: { type: string }) {
  const cls = 'h-4 w-4'
  switch (type) {
    case 'friend_request': return <UserPlusIcon className={cls} />
    case 'friend_accepted': return <CheckCircleIcon className={cls} />
    case 'approval': return <CheckCircleIcon className={cls} />
    case 'rejection': return <XCircleIcon className={cls} />
    case 'new_release': return <MusicalNoteIcon className={cls} />
    case 'jam_invite': return <UserGroupIcon className={cls} />
    default: return <MusicalNoteIcon className={cls} />
  }
}

export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const items = useNotificationStore((s) => s.items)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const clearAll = useNotificationStore((s) => s.clearAll)

  const handleClick = (n: AppNotification) => {
    void markRead(n.id)
    // Dual-clear: tapping a jam invite also clears the matching chat unread,
    // since the host's chat card carries the same invite.
    if (n.type === 'jam_invite' && n.linkUrl) {
      const hostId = JAM_USER_LINK.exec(n.linkUrl)?.[1]
      if (hostId) void useChatStore.getState().markRead(hostId)
    }
    setOpen(false)
    if (n.linkUrl) navigate(n.linkUrl)
  }

  return (
    <div className="relative hidden md:block">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        className={cn(
          'spotify-tooltip-anchor relative flex h-10 w-8 items-center justify-center rounded-full transition-all hover:scale-105 hover:text-primary active:scale-95',
          open ? 'text-primary' : 'text-secondary',
        )}
      >
        {open ? <BellSolid className="h-5 w-5" /> : <BellIcon className="h-5 w-5" />}
        <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-center">Notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[990]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-[1000] mt-2 w-80 max-h-[480px] overflow-hidden rounded-md border border-secondary/10 bg-elevated shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2.5">
              <p className="text-sm font-bold text-primary">Notifications</p>
              {items.length > 0 && (
                <div className="flex items-center gap-3 text-xs font-semibold">
                  {unreadCount > 0 && (
                    <button onClick={() => void markAllRead()} className="text-accent hover:underline">
                      Mark all read
                    </button>
                  )}
                  <button onClick={() => void clearAll()} className="text-secondary hover:text-primary">
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-secondary">No notifications yet.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface',
                      !n.isRead && 'bg-accent/5',
                    )}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-secondary">
                      {n.imageUrl ? (
                        <img src={n.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <NotificationIcon type={n.type} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-primary">{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-secondary">{n.body}</span>}
                      <span className="mt-0.5 block text-[11px] text-muted">{formatRelativeTime(n.createdAt)}</span>
                    </span>
                    {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
