import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { XMarkIcon, UsersIcon, MusicalNoteIcon } from '@heroicons/react/24/outline'
import { Avatar } from '@/components/ui/Avatar'
import { useFriendStore } from '@/stores/friendStore'
import { useUiStore } from '@/stores/uiStore'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import type { FriendWithActivity } from '@/types/friend'

/** Animated three-bar equalizer shown next to friends listening right now. */
function ListeningBars() {
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-label="Listening now" title="Listening now">
      <span className="fa-eq-bar w-[3px] rounded-sm bg-accent" style={{ animationDelay: '0ms' }} />
      <span className="fa-eq-bar w-[3px] rounded-sm bg-accent" style={{ animationDelay: '180ms' }} />
      <span className="fa-eq-bar w-[3px] rounded-sm bg-accent" style={{ animationDelay: '320ms' }} />
      <style>{`
        .fa-eq-bar {
          height: 30%;
          animation: fa-eq-bounce 0.9s ease-in-out infinite;
          transform-origin: bottom;
        }
        @keyframes fa-eq-bounce {
          0%, 100% { height: 30%; }
          35% { height: 100%; }
          70% { height: 50%; }
        }
      `}</style>
    </span>
  )
}

function ActivityItem({ friend }: { friend: FriendWithActivity }) {
  const track = friend.nowPlaying
  if (!track) return null

  return (
    <li className="flex gap-3 px-4 py-3 transition-colors hover:bg-elevated/60">
      <Link to={`/user/${friend.userId}`} className="relative shrink-0 self-start" title={friend.name}>
        <Avatar src={friend.avatarUrl} alt={friend.name} size="sm" round />
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${
            friend.isOnline ? 'bg-green-400' : 'bg-secondary/50'
          }`}
        />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <Link
            to={`/user/${friend.userId}`}
            className="min-w-0 truncate text-xs font-bold text-secondary transition-colors hover:text-primary hover:underline"
          >
            {friend.name}
          </Link>
          <span className="shrink-0 text-[11px] font-semibold text-secondary">
            {friend.isListeningNow ? (
              <ListeningBars />
            ) : friend.playedAt ? (
              formatRelativeTime(friend.playedAt)
            ) : null}
          </span>
        </div>

        <p className="truncate text-sm leading-snug">
          <Link
            to={`/track/${track.id}`}
            className={`font-semibold transition-colors hover:underline ${
              friend.isListeningNow ? 'text-primary' : 'text-secondary hover:text-primary'
            }`}
          >
            {track.title}
          </Link>
          <span className="text-secondary"> · </span>
          <Link
            to={`/artist/${track.artist.id}`}
            className="text-secondary transition-colors hover:text-primary hover:underline"
          >
            {track.artist.name}
          </Link>
        </p>

        <Link
          to={`/album/${track.album.id}`}
          className="mt-0.5 flex items-center gap-1 text-xs text-secondary transition-colors hover:text-primary"
        >
          <MusicalNoteIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">{track.album.title}</span>
        </Link>
      </div>
    </li>
  )
}

/**
 * Spotify-style "Friend Activity" right rail. Shows what each friend is
 * listening to right now (animated bars) or played most recently (timestamp).
 * Shares the right-panel slot with NowPlayingPanel — see AppShell.
 */
export function FriendActivityPanel() {
  const setFriendActivityOpen = useUiStore((s) => s.setFriendActivityOpen)
  const getFriendsWithActivity = useFriendStore((s) => s.getFriendsWithActivity)
  const fetchActivity = useFriendStore((s) => s.fetchActivity)
  const fetchFriends = useFriendStore((s) => s.fetchFriends)
  // Subscribe to the raw slices so the memoless getter re-runs on poll updates.
  const friendCount = useFriendStore((s) => s.friends.length)
  const lastActivityFetch = useFriendStore((s) => s.lastActivityFetch)

  // Refresh immediately on open; useFriendPolling keeps it fresh afterwards.
  useEffect(() => {
    void fetchFriends()
    void fetchActivity()
  }, [])

  // Re-render every 30 s so "x min" timestamps don't go stale between polls.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const withTrack = getFriendsWithActivity()
    .filter((f) => f.nowPlaying !== null)
    .sort((a, b) => {
      if (a.isListeningNow !== b.isListeningNow) return a.isListeningNow ? -1 : 1
      return (b.playedAt ?? '').localeCompare(a.playedAt ?? '')
    })

  return (
    <aside className="relative hidden w-80 shrink-0 flex-col overflow-hidden rounded-xl bg-surface lg:flex">
      <div className="flex items-center justify-between p-4 pb-2">
        <h2 className="text-base font-bold text-primary">Friend Activity</h2>
        <button
          onClick={() => setFriendActivityOpen(false)}
          className="rounded-full p-1 text-secondary transition-all hover:scale-110 hover:bg-elevated hover:text-primary active:scale-95"
          aria-label="Close friend activity"
          title="Close friend activity"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="spotify-scrollbar min-h-0 flex-1 overflow-y-auto pb-4">
        {withTrack.length > 0 ? (
          <ul>
            {withTrack.map((f) => (
              <ActivityItem key={f.userId} friend={f} />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 pt-10 text-center">
            <UsersIcon className="h-10 w-10 text-secondary" />
            {friendCount === 0 ? (
              <>
                <p className="text-sm font-bold text-primary">Find friends to follow</p>
                <p className="text-xs text-secondary">
                  Add friends from the Friends menu in the top bar to see what they're listening to.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-primary">It's quiet right now</p>
                <p className="text-xs text-secondary">
                  {lastActivityFetch === 0
                    ? 'Loading friend activity…'
                    : "None of your friends have played anything recently. Check back later."}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

export function FriendActivityContent() {
  const getFriendsWithActivity = useFriendStore((s) => s.getFriendsWithActivity)
  const fetchActivity = useFriendStore((s) => s.fetchActivity)
  const fetchFriends = useFriendStore((s) => s.fetchFriends)
  const friendCount = useFriendStore((s) => s.friends.length)
  const lastActivityFetch = useFriendStore((s) => s.lastActivityFetch)

  useEffect(() => {
    void fetchFriends()
    void fetchActivity()
  }, [fetchActivity, fetchFriends])

  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const withTrack = getFriendsWithActivity()
    .filter((f) => f.nowPlaying !== null)
    .sort((a, b) => {
      if (a.isListeningNow !== b.isListeningNow) return a.isListeningNow ? -1 : 1
      return (b.playedAt ?? '').localeCompare(a.playedAt ?? '')
    })

  return (
    <div className="spotify-scrollbar h-full overflow-y-auto pb-4">
      {withTrack.length > 0 ? (
        <ul>
          {withTrack.map((f) => (
            <ActivityItem key={f.userId} friend={f} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 px-6 pt-10 text-center">
          <UsersIcon className="h-10 w-10 text-secondary" />
          {friendCount === 0 ? (
            <>
              <p className="text-sm font-bold text-primary">Find friends to follow</p>
              <p className="text-xs text-secondary">
                Add friends from the Friends tab to see what they're listening to.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-primary">It's quiet right now</p>
              <p className="text-xs text-secondary">
                {lastActivityFetch === 0
                  ? 'Loading friend activity…'
                  : "None of your friends have played anything recently. Check back later."}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
