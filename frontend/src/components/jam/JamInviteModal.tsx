import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { Avatar } from '@/components/ui/Avatar'
import { useFriendStore } from '@/stores/friendStore'
import { useChatStore } from '@/stores/chatStore'
import { friendService } from '@/services/friendService'
import { encodeJamShare } from '@/utils/chatShare'
import { shareLink } from '@/utils/share'
import { notify } from '@/utils/toast'

interface Props {
  hostId: string
  hostName: string
  onClose: () => void
}

export function JamInviteModal({ hostId, hostName, onClose }: Props) {
  const friends = useFriendStore((s) => s.friends)
  const fetchFriends = useFriendStore((s) => s.fetchFriends)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const [query, setQuery] = useState('')
  const [sent, setSent] = useState<Record<string, boolean>>({})
  const [sending, setSending] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (friends.length === 0) void fetchFriends()
  }, [fetchFriends, friends.length])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? friends.filter((friend) => friend.name.toLowerCase().includes(q)) : friends
  }, [friends, query])

  const sendInvite = async (userId: string, name: string) => {
    setSending((current) => ({ ...current, [userId]: true }))
    try {
      await Promise.all([
        sendMessage(userId, encodeJamShare(hostId, hostName)),
        friendService.inviteToJam(userId),
      ])
      setSent((current) => ({ ...current, [userId]: true }))
      notify.success(`Jam invite sent to ${name}`)
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message
      notify.error(message ?? 'Jam invite could not be sent.')
    } finally {
      setSending((current) => {
        const { [userId]: _drop, ...rest } = current
        return rest
      })
    }
  }

  const copyInvite = async () => {
    const result = await shareLink(`/user/${hostId}?joinJam=1`, { title: 'Join my Jam on not-spotify' })
    if (result === 'copied') {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Invite friends to Jam"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-elevated/50 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-primary">Invite friends to Jam</h2>
            <p className="text-xs text-secondary">They'll get a chat card and a notification.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-secondary hover:bg-elevated hover:text-primary" aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 pb-2">
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-secondary/30 px-4 py-2 text-sm font-bold text-primary hover:border-primary"
          >
            {copied ? <CheckIcon className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
            {copied ? 'Invite link copied' : 'Copy invite link'}
          </button>
        </div>

        <div className="px-4 pb-2">
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search friends"
              className="h-10 w-full rounded-full bg-elevated pl-9 pr-3 text-sm text-primary outline-none placeholder:text-muted focus:ring-1 focus:ring-accent/60"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-secondary">
              {friends.length === 0 ? 'Add friends before inviting people to a Jam.' : 'No friends match that search.'}
            </p>
          ) : filtered.map((friend) => (
            <div key={friend.userId} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-elevated/50">
              <Avatar src={friend.avatarUrl} alt={friend.name} size="md" round />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">{friend.name}</p>
              <button
                type="button"
                onClick={() => void sendInvite(friend.userId, friend.name)}
                className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-black hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
                disabled={sent[friend.userId] || sending[friend.userId]}
                aria-label={`Invite ${friend.name} to Jam`}
              >
                {sent[friend.userId] ? (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    Sent
                  </>
                ) : (
                  <>
                    <PaperAirplaneIcon className="h-4 w-4" />
                    {sending[friend.userId] ? 'Sending…' : 'Send'}
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
