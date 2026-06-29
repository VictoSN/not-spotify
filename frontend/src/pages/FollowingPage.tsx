import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { friendService } from '@/services/friendService'
import { ArtistCard } from '@/components/cards/ArtistCard'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'
import type { FollowUser } from '@/types/friend'

type FollowingFilter = 'all' | 'artists' | 'profiles'

const FILTER_LABELS: Record<FollowingFilter, string> = {
  all: 'All',
  artists: 'Artists',
  profiles: 'Profiles',
}

function isFollowingFilter(value: string | null): value is FollowingFilter {
  return value === 'all' || value === 'artists' || value === 'profiles'
}

export function FollowingPage() {
  const user = useAuthStore((state) => state.user)
  const followedArtists = useLibraryStore((state) => state.followedArtists)
  const libraryLoading = useLibraryStore((state) => state.isLoading)
  const fetchLibrary = useLibraryStore((state) => state.fetchLibrary)
  const [profiles, setProfiles] = useState<FollowUser[]>([])
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedFilter = searchParams.get('filter')
  const filter: FollowingFilter = isFollowingFilter(requestedFilter) ? requestedFilter : 'all'

  useEffect(() => {
    void fetchLibrary()
  }, [fetchLibrary])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setProfilesLoading(true)
    friendService.getFollowing(user.id)
      .then((users) => { if (!cancelled) setProfiles(users) })
      .catch(() => { if (!cancelled) setProfiles([]) })
      .finally(() => { if (!cancelled) setProfilesLoading(false) })
    return () => { cancelled = true }
  }, [user])

  if (!user) return null

  const followedArtistIds = new Set(followedArtists.map((artist) => artist.id))
  const artistProfiles = profiles.filter(
    (profile) => profile.isArtist && (!profile.artistId || !followedArtistIds.has(profile.artistId)),
  )
  const regularProfiles = profiles.filter((profile) => !profile.isArtist)
  const showArtists = filter === 'all' || filter === 'artists'
  const showProfiles = filter === 'all' || filter === 'profiles'
  const empty = (!showArtists || followedArtists.length + artistProfiles.length === 0)
    && (!showProfiles || regularProfiles.length === 0)

  return (
    <div className="px-6 py-8">
      <h1 className="text-3xl font-black text-primary">Following</h1>

      <div className="mb-8 mt-7 flex items-center gap-2" aria-label="Following filters">
        {(['all', 'artists', 'profiles'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setSearchParams(option === 'all' ? {} : { filter: option }, { replace: true })}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all hover:scale-105 active:scale-95',
              filter === option
                ? 'bg-primary text-page'
                : 'bg-elevated text-primary hover:bg-elevated/75',
            )}
            aria-pressed={filter === option}
          >
            {FILTER_LABELS[option]}
          </button>
        ))}
      </div>

      {libraryLoading || profilesLoading ? (
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
      ) : empty ? (
        <p className="text-sm text-secondary">You are not following anyone in this category yet.</p>
      ) : (
        <div className="grid [grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))] gap-x-4 gap-y-7">
          {showArtists && followedArtists.map((artist) => (
            <ArtistCard key={`artist-${artist.id}`} artist={artist} fluid />
          ))}

          {showArtists && artistProfiles.map((profile) => (
            <FollowedProfileCard key={`artist-profile-${profile.id}`} profile={profile} ownUserId={user.id} />
          ))}

          {showProfiles && regularProfiles.map((profile) => (
            <FollowedProfileCard key={`profile-${profile.id}`} profile={profile} ownUserId={user.id} />
          ))}
        </div>
      )}
    </div>
  )
}

function FollowedProfileCard({ profile, ownUserId }: { profile: FollowUser; ownUserId: string }) {
  return (
    <Link
      to={profile.id === ownUserId ? '/profile' : `/user/${profile.id}`}
      className="group min-w-0 rounded-lg p-3 transition-colors hover:bg-surface"
    >
      <Avatar
        src={profile.avatarUrl}
        alt={profile.name}
        size="xl"
        round
        className="aspect-square h-auto w-full text-4xl shadow-lg transition-transform duration-300 group-hover:scale-[1.03]"
      />
      <p className="mt-3 truncate text-sm font-semibold text-primary">{profile.name}</p>
      <p className="mt-0.5 text-xs text-secondary">{profile.isArtist ? 'Artist' : 'Profile'}</p>
    </Link>
  )
}
