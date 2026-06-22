import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { UserPlusIcon, UserMinusIcon, SparklesIcon, UserGroupIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useFriendStore } from '@/stores/friendStore'
import { useJamStore } from '@/stores/jamStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { profileGradient, useDominantColor } from '@/hooks/useDominantColor'
import { friendService } from '@/services/friendService'
import { Avatar } from '@/components/ui/Avatar'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { TrackTile } from '@/components/cards/TrackTile'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { Spinner } from '@/components/ui/Spinner'
import { FollowListModal } from '@/components/profile/FollowListModal'
import { notify } from '@/utils/toast'
import type { PublicUserProfile } from '@/types/friend'
import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'

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
  const [topTracks, setTopTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [friendActionBusy, setFriendActionBusy] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [blendBusy, setBlendBusy] = useState(false)
  const [blendEmpty, setBlendEmpty] = useState(false)
  // Follow state is kept locally so the button + counts update instantly.
  const [following, setFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null)
  const playWithGate = usePlaybackGate()
  const jamRole = useJamStore((s) => s.role)
  const joinAs = useJamStore((s) => s.joinAs)

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
      friendService.getUserTopTracks(userId).catch(() => [] as Track[]),
    ])
      .then(([p, pls, tracks]) => {
        setProfile(p)
        setPlaylists(pls)
        setTopTracks(tracks)
        setFollowing(p.isFollowing === true)
        setFollowerCount(p.followerCount)
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

  const handleFollow = async () => {
    if (!isAuthenticated) {
      openAuthPrompt({
        title: 'Follow people with a free account',
        imageUrl: profile?.avatarUrl ?? null,
      })
      return
    }
    if (!userId) return
    const next = !following
    setFollowBusy(true)
    setFollowing(next)
    setFollowerCount((c) => Math.max(0, c + (next ? 1 : -1)))
    try {
      if (next) await friendService.follow(userId)
      else await friendService.unfollow(userId)
    } catch {
      setFollowing(!next)
      setFollowerCount((c) => Math.max(0, c + (next ? -1 : 1)))
      notify.error(next ? 'Could not follow.' : 'Could not unfollow.')
    } finally {
      setFollowBusy(false)
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
            background: profileGradient(heroColor),
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
              <span className="text-secondary/30">•</span>
              <button
                type="button"
                onClick={() => setFollowModal('followers')}
                className="font-semibold text-primary transition-colors hover:underline"
              >
                {followerCount}
                <span className="font-normal text-secondary"> follower{followerCount === 1 ? '' : 's'}</span>
              </button>
              <span className="text-secondary/30">•</span>
              <button
                type="button"
                onClick={() => setFollowModal('following')}
                className="font-semibold text-primary transition-colors hover:underline"
              >
                {profile.followingCount}
                <span className="font-normal text-secondary"> following</span>
              </button>
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

        {/* Follow — asymmetric, no acceptance needed (distinct from friending) */}
        <button
          onClick={() => void handleFollow()}
          disabled={followBusy}
          className={
            following
              ? 'flex items-center gap-2 rounded-full border border-secondary/40 px-4 py-2 text-sm font-semibold text-secondary transition-all hover:scale-105 hover:border-primary hover:text-primary active:scale-95 disabled:opacity-50'
              : 'flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-page transition-transform hover:scale-105 active:scale-95 disabled:opacity-50'
          }
        >
          {following ? (
            <>
              <CheckIcon className="h-4 w-4" />
              Following
            </>
          ) : (
            'Follow'
          )}
        </button>

        {/* Blend — a shared mix of both your top tracks (friends only) */}
        {isFriend && userId && (
          <button
            onClick={async () => {
              if (blendBusy) return
              setBlendBusy(true)
              try {
                const tracks = await friendService.getBlend(userId)
                if (tracks.length > 0) playWithGate(tracks[0], tracks)
                else setBlendEmpty(true)
              } catch {
                setBlendEmpty(true)
              } finally {
                setBlendBusy(false)
              }
            }}
            disabled={blendBusy}
            className="flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition-all hover:scale-105 hover:bg-accent/20 active:scale-95 disabled:opacity-50"
            title={`Play a blend of you and ${profile.name}`}
          >
            <SparklesIcon className="h-4 w-4" />
            {blendBusy ? 'Blending…' : blendEmpty ? 'Not enough history yet' : `Blend with ${profile.name.split(' ')[0]}`}
          </button>
        )}

        {/* Listen along — join this friend's jam (if they're hosting one) */}
        {isFriend && userId && jamRole === 'off' && (
          <button
            onClick={() => joinAs(userId, profile.name)}
            className="flex items-center gap-2 rounded-full border border-secondary/30 px-4 py-2 text-sm font-semibold text-secondary transition-all hover:scale-105 hover:border-primary hover:text-primary active:scale-95"
            title={`Listen along with ${profile.name}`}
          >
            <UserGroupIcon className="h-4 w-4" />
            Listen along
          </button>
        )}
      </div>

      {/* Top tracks this month */}
      {topTracks.length > 0 && (
        <div className="px-6 py-4">
          <h2 className="mb-4 text-xl font-bold text-primary">Top tracks this month</h2>
          <HorizontalScroller>
            {topTracks.map((t) => (
              <TrackTile key={t.id} track={t} queue={topTracks} />
            ))}
          </HorizontalScroller>
        </div>
      )}

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

      {followModal && userId && (
        <FollowListModal
          open={followModal !== null}
          onClose={() => setFollowModal(null)}
          userId={userId}
          mode={followModal}
        />
      )}
    </div>
  )
}
