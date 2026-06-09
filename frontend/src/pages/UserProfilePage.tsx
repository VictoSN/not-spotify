import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { UserPlusIcon, UserMinusIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useFriendStore } from '@/stores/friendStore'
import { useDominantColor } from '@/hooks/useDominantColor'
import { friendService } from '@/services/friendService'
import { Avatar } from '@/components/ui/Avatar'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { Spinner } from '@/components/ui/Spinner'
import type { PublicUserProfile } from '@/types/friend'
import type { Playlist } from '@/types/playlist'

export function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const currentUser = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const friends = useFriendStore((s) => s.friends)
  const sendRequest = useFriendStore((s) => s.sendRequest)
  const unfriend = useFriendStore((s) => s.unfriend)

  const [profile, setProfile] = useState<PublicUserProfile | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [friendActionBusy, setFriendActionBusy] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  const heroColor = useDominantColor(profile?.avatarUrl)

  // Must come AFTER all hooks — conditional returns before hooks violate Rules of Hooks.
  const isOwnProfile = Boolean(userId && currentUser && userId === currentUser.id)

  useEffect(() => {
    // Don't fetch data for own profile — the redirect below handles that case.
    if (!userId || isOwnProfile) return
    setLoading(true)
    Promise.all([
      friendService.getUserProfile(userId),
      friendService.getUserPlaylists(userId),
    ])
      .then(([p, pls]) => {
        setProfile(p)
        setPlaylists(pls)
      })
      .catch(() => {
        // 404 → profile stays null → "User not found" shown below
      })
      .finally(() => setLoading(false))
  }, [userId, isOwnProfile])

  const isFriend = friends.some((f) => f.userId === userId)

  const handleFriendAction = async () => {
    if (!isAuthenticated) {
      openAuthPrompt({
        title: 'Add friends with a free account',
        imageUrl: profile?.avatarUrl ?? null,
      })
      return
    }
    if (!userId) return
    setFriendActionBusy(true)
    try {
      if (isFriend) {
        await unfriend(userId)
      } else {
        await sendRequest(userId)
        setRequestSent(true)
      }
    } finally {
      setFriendActionBusy(false)
    }
  }

  // Redirect is placed here — after all hooks — to satisfy Rules of Hooks.
  if (isOwnProfile) {
    return <Navigate to="/profile" replace />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-secondary text-sm">User not found.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Hero */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-80"
          style={{
            background: `linear-gradient(180deg, ${heroColor ?? 'var(--c-accent-dim)'} 0%, transparent 100%)`,
          }}
        />
        <div className="relative flex flex-col items-center gap-6 px-6 pb-6 pt-16 sm:flex-row sm:items-end">
          <Avatar
            src={profile.avatarUrl}
            alt={profile.name}
            size="xl"
            round
            className="h-36 w-36 text-5xl shadow-2xl sm:h-52 sm:w-52"
          />
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-sm font-bold text-primary">Profile</p>
            <h1 className="my-3 break-words text-5xl font-black text-primary sm:text-7xl">
              {profile.name}
            </h1>
            <div className="flex items-center gap-3 justify-center sm:justify-start flex-wrap text-sm text-secondary">
              <span>{playlists.length} Public Playlist{playlists.length === 1 ? '' : 's'}</span>
              {isAuthenticated && profile.mutualFriendsCount > 0 && (
                <>
                  <span className="text-secondary/30">•</span>
                  <span>
                    {profile.mutualFriendsCount} mutual friend{profile.mutualFriendsCount !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-6 py-4">
        <button
          onClick={() => void handleFriendAction()}
          disabled={friendActionBusy || requestSent}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-secondary/30 text-secondary hover:text-primary hover:border-primary transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {isFriend ? (
            <>
              <UserMinusIcon className="w-4 h-4" />
              Unfriend
            </>
          ) : requestSent ? (
            <>
              <UserPlusIcon className="w-4 h-4" />
              Request sent
            </>
          ) : (
            <>
              <UserPlusIcon className="w-4 h-4" />
              Add friend
            </>
          )}
        </button>
      </div>

      {/* Playlists */}
      {playlists.length > 0 && (
        <div className="px-6 py-4">
          <h2 className="text-xl font-bold text-primary mb-4">Playlists</h2>
          <HorizontalScroller>
            {playlists.map((p) => (
              <PlaylistCard key={p.id} playlist={p} />
            ))}
          </HorizontalScroller>
        </div>
      )}

      {playlists.length === 0 && (
        <div className="px-6 py-4">
          <p className="text-secondary text-sm">No public playlists yet.</p>
        </div>
      )}
    </div>
  )
}
