import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  CheckIcon,
  XMarkIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline'
import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import { Avatar } from '@/components/ui/Avatar'
import { useFriendStore } from '@/stores/friendStore'
import { friendService } from '@/services/friendService'
import { useDebounce } from '@/hooks/useDebounce'
import type { UserSearchResult, FriendWithActivity, FriendSuggestion } from '@/types/friend'

interface FriendPanelProps {
  onClose: () => void
}

// ─── Friend search section ───────────────────────────────────────────────────

function FriendSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const sendRequest = useFriendStore((s) => s.sendRequest)
  const friends = useFriendStore((s) => s.friends)
  const friendIds = new Set(friends.map((f) => f.userId))

  useEffect(() => {
    const q = debouncedQuery.trim()
    if (!q) { setResults([]); return }
    setSearching(true)
    friendService.searchUsers(q)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setSearching(false))
  }, [debouncedQuery])

  const handleSend = async (userId: string) => {
    try {
      await sendRequest(userId)
      setSentIds((s) => new Set([...s, userId]))
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <p className="px-3 py-2 text-xs font-semibold text-secondary uppercase tracking-wider">
        Find friends
      </p>
      <div className="px-3 pb-2">
        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users…"
            className="w-full h-9 rounded-md bg-surface text-sm text-primary placeholder:text-muted pl-8 pr-3 outline-none focus:ring-1 focus:ring-accent/50"
          />
        </div>
      </div>

      {searching && (
        <p className="px-3 py-2 text-xs text-secondary">Searching…</p>
      )}

      {!searching && debouncedQuery.trim() && results.length === 0 && (
        <p className="px-3 py-2 text-xs text-secondary">No users found.</p>
      )}

      {results.map((u) => {
        const isFriend = friendIds.has(u.id)
        const sent = sentIds.has(u.id)
        return (
          <div key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-surface rounded-md">
            <Avatar src={u.avatarUrl} alt={u.name} size="sm" round />
            <div className="flex-1 min-w-0">
              <p className="flex items-center gap-1 text-sm font-semibold text-primary truncate">
                <span className="truncate">{u.name}</span>
                {u.isArtist && <CheckBadgeIcon className="h-3.5 w-3.5 shrink-0 text-accent" aria-label="Verified artist" />}
              </p>
              {u.isArtist ? (
                <p className="text-xs text-secondary truncate">Artist</p>
              ) : u.mutualFriendsCount > 0 ? (
                <p className="text-xs text-secondary truncate">
                  {u.mutualFriendsCount} mutual friend{u.mutualFriendsCount !== 1 ? 's' : ''}
                </p>
              ) : null}
            </div>
            {isFriend ? (
              <span className="text-xs text-secondary shrink-0">Friends</span>
            ) : sent ? (
              <span className="text-xs text-secondary shrink-0">Sent</span>
            ) : (
              <button
                onClick={() => void handleSend(u.id)}
                className="shrink-0 flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
                aria-label={`Add ${u.name} as friend`}
              >
                <UserPlusIcon className="w-4 h-4" />
                Add
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Pending requests section ─────────────────────────────────────────────────

function PendingRequests() {
  const requests = useFriendStore((s) => s.requests)
  const acceptRequest = useFriendStore((s) => s.acceptRequest)
  const declineRequest = useFriendStore((s) => s.declineRequest)
  const [busyId, setBusyId] = useState<string | null>(null)

  if (requests.length === 0) return null

  const handle = async (id: string, action: 'accept' | 'decline') => {
    setBusyId(id)
    try {
      if (action === 'accept') await acceptRequest(id)
      else await declineRequest(id)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="my-1 border-t border-secondary/10" />
      <p className="px-3 py-2 text-xs font-semibold text-secondary uppercase tracking-wider">
        Friend requests ({requests.length})
      </p>
      {requests.map((req) => (
        <div key={req.id} className="flex items-center gap-3 px-3 py-2">
          <Avatar src={req.fromUser.avatarUrl} alt={req.fromUser.name} size="sm" round />
          <p className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{req.fromUser.name}</p>
          <button
            onClick={() => void handle(req.id, 'accept')}
            disabled={busyId === req.id}
            aria-label="Accept"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-accent text-white hover:bg-accent/80 transition-colors disabled:opacity-50"
          >
            <CheckIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => void handle(req.id, 'decline')}
            disabled={busyId === req.id}
            aria-label="Decline"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-surface text-secondary hover:text-primary hover:bg-elevated transition-colors disabled:opacity-50"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Individual friend row ────────────────────────────────────────────────────

function FriendListItem({ friend, onClose }: { friend: FriendWithActivity; onClose: () => void }) {
  return (
    <Link
      to={`/user/${friend.userId}`}
      onClick={onClose}
      className="flex items-center gap-3 px-3 py-2 hover:bg-surface rounded-md transition-colors"
    >
      <div className="relative shrink-0">
        <Avatar src={friend.avatarUrl} alt={friend.name} size="sm" round />
        {/* Online dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-elevated ${
            friend.isOnline ? 'bg-green-400' : 'bg-secondary/50'
          }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{friend.name}</p>
        {friend.nowPlaying ? (
          <p className="text-xs text-accent truncate">
            ▶ {friend.nowPlaying.title}
            {' · '}
            {friend.nowPlaying.artist.name}
          </p>
        ) : friend.isOnline ? (
          <p className="text-xs text-green-400">Online</p>
        ) : friend.mutualFriendsCount > 0 ? (
          <p className="text-xs text-secondary truncate">
            {friend.mutualFriendsCount} mutual friend{friend.mutualFriendsCount !== 1 ? 's' : ''}
          </p>
        ) : (
          <p className="text-xs text-secondary">Offline</p>
        )}
      </div>
    </Link>
  )
}

// ─── Friends list section ─────────────────────────────────────────────────────

function FriendsList({ onClose }: { onClose: () => void }) {
  const getFriendsWithActivity = useFriendStore((s) => s.getFriendsWithActivity)
  const isLoading = useFriendStore((s) => s.isLoading)
  const friendsWithActivity = getFriendsWithActivity()

  return (
    <div>
      <div className="my-1 border-t border-secondary/10" />
      <p className="px-3 py-2 text-xs font-semibold text-secondary uppercase tracking-wider">
        Friends
      </p>
      {isLoading && <p className="px-3 py-2 text-xs text-secondary">Loading…</p>}
      {!isLoading && friendsWithActivity.length === 0 && (
        <p className="px-3 py-2 text-xs text-secondary">
          You haven't added any friends yet. Search above to find people.
        </p>
      )}
      {friendsWithActivity.map((f) => (
        <FriendListItem key={f.userId} friend={f} onClose={onClose} />
      ))}
    </div>
  )
}

// ─── Suggestions ("People you may know") ─────────────────────────────────────

function FriendSuggestions() {
  const suggestions = useFriendStore((s) => s.suggestions)
  const sendRequest = useFriendStore((s) => s.sendRequest)
  const friends = useFriendStore((s) => s.friends)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const friendIds = new Set(friends.map((f) => f.userId))

  // Don't render the section when there's nothing to show.
  if (suggestions.length === 0) return null

  const handleSend = async (id: string) => {
    try {
      await sendRequest(id)
      setSentIds((s) => new Set([...s, id]))
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <div className="my-1 border-t border-secondary/10" />
      <p className="px-3 py-2 text-xs font-semibold text-secondary uppercase tracking-wider">
        People you may know
      </p>
      {suggestions.map((s: FriendSuggestion) => {
        const isFriend = friendIds.has(s.id)
        const sent = sentIds.has(s.id)
        return (
          <div key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-surface rounded-md">
            <Avatar src={s.avatarUrl} alt={s.name} size="sm" round />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary truncate">{s.name}</p>
              <p className="text-xs text-secondary truncate">
                {s.mutualFriendsCount} mutual friend{s.mutualFriendsCount !== 1 ? 's' : ''}
              </p>
            </div>
            {isFriend ? (
              <span className="text-xs text-secondary shrink-0">Friends</span>
            ) : sent ? (
              <span className="text-xs text-secondary shrink-0">Sent</span>
            ) : (
              <button
                onClick={() => void handleSend(s.id)}
                className="shrink-0 flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
                aria-label={`Add ${s.name} as friend`}
              >
                <UserPlusIcon className="w-4 h-4" />
                Add
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Panel root ───────────────────────────────────────────────────────────────

export function FriendPanel({ onClose }: FriendPanelProps) {
  const fetchActivity = useFriendStore((s) => s.fetchActivity)
  const fetchFriends = useFriendStore((s) => s.fetchFriends)
  const fetchRequests = useFriendStore((s) => s.fetchRequests)

  // Refresh immediately when the panel opens so the user never sees stale data.
  useEffect(() => {
    void fetchActivity()
    void fetchFriends()
    void fetchRequests()
  }, [])

  return (
    <div className="absolute right-0 top-full mt-2 w-80 max-h-[520px] overflow-y-auto rounded-md bg-elevated shadow-2xl border border-secondary/10 py-2 z-50">
      <FriendSearch />
      <PendingRequests />
      <FriendsList onClose={onClose} />
      <FriendSuggestions />
    </div>
  )
}
