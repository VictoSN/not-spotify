import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, MagnifyingGlassIcon, CheckIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import type { Track } from '@/types/track'
import { useFriendStore } from '@/stores/friendStore'
import { useChatStore } from '@/stores/chatStore'
import { Avatar } from '@/components/ui/Avatar'
import { encodeTrackShare } from '@/utils/chatShare'
import { notify } from '@/utils/toast'
import { cn } from '@/utils/cn'

interface Props {
  track: Track
  onClose: () => void
}

/** Pick a friend (or several) to send a track to as a rich chat message. */
export function ShareToChatModal({ track, onClose }: Props) {
  const friends = useFriendStore((s) => s.friends)
  const fetchFriends = useFriendStore((s) => s.fetchFriends)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const [query, setQuery] = useState('')
  const [sentTo, setSentTo] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (friends.length === 0) fetchFriends()
  }, [friends.length, fetchFriends])

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? friends.filter((f) => f.name.toLowerCase().includes(q)) : friends
  }, [friends, query])

  const share = (userId: string, name: string) => {
    if (sentTo.has(userId)) return
    void sendMessage(userId, encodeTrackShare(track.id))
    setSentTo((prev) => new Set(prev).add(userId))
    notify.success(`Sent “${track.title}” to ${name}`)
  }

  return createPortal(
    <div
      className="animate-auth-overlay-in fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share to chat"
    >
      <div
        className="animate-auth-card-in flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-elevated/50 px-4 py-3">
          <h2 className="text-base font-bold text-primary">Share to a friend</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-secondary transition-colors hover:bg-elevated hover:text-primary"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Track being shared */}
        <div className="flex items-center gap-3 px-4 py-3">
          <img src={track.album.coverUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-primary">{track.title}</p>
            <p className="truncate text-xs text-secondary">{track.artist.name}</p>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search friends"
              className="h-10 w-full rounded-full border border-transparent bg-elevated pl-9 pr-3 text-sm text-primary outline-none transition-colors placeholder:text-muted focus:border-accent/60"
            />
          </div>
        </div>

        {/* Friend list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-secondary">
              {friends.length === 0 ? 'Add some friends to share music with them.' : 'No friends match that search.'}
            </p>
          ) : (
            filtered.map((f) => {
              const sent = sentTo.has(f.userId)
              return (
                <div key={f.userId} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-elevated/50">
                  <Avatar src={f.avatarUrl} alt={f.name} size="md" round />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">{f.name}</p>
                  <button
                    onClick={() => share(f.userId, f.name)}
                    disabled={sent}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95',
                      sent
                        ? 'cursor-default bg-elevated text-secondary'
                        : 'bg-accent text-white hover:scale-105',
                    )}
                  >
                    {sent ? (
                      <>
                        <CheckIcon className="h-3.5 w-3.5" />
                        Sent
                      </>
                    ) : (
                      <>
                        <PaperAirplaneIcon className="h-3.5 w-3.5" />
                        Send
                      </>
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
