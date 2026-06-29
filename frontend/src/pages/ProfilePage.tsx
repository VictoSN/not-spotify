import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import {
  Cog6ToothIcon,
  EllipsisHorizontalIcon,
  PencilIcon,
  Square2StackIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { friendService } from '@/services/friendService'
import { profileGradient, useDominantColor } from '@/hooks/useDominantColor'
import { Avatar } from '@/components/ui/Avatar'
import { ArtistCard } from '@/components/cards/ArtistCard'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { TrackRow } from '@/components/cards/TrackRow'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { SectionHeader } from '@/components/common/SectionHeader'
import { EditProfileModal } from '@/components/profile/EditProfileModal'
import { FollowListModal } from '@/components/profile/FollowListModal'
import { useTranslation } from '@/i18n/useTranslation'
import { notify } from '@/utils/toast'
import type { FollowUser } from '@/types/friend'

export function ProfilePage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const { followedArtists, likedSongs, savedPlaylists, fetchLibrary } = useLibraryStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editOpen, setEditOpen] = useState(searchParams.get('edit') === '1')
  const [followersOpen, setFollowersOpen] = useState(false)
  const [followers, setFollowers] = useState<FollowUser[]>([])
  const [followedProfiles, setFollowedProfiles] = useState<FollowUser[]>([])
  const heroColor = useDominantColor(user?.avatarUrl)

  useEffect(() => {
    void fetchLibrary()
  }, [fetchLibrary])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    Promise.all([friendService.getFollowers(user.id), friendService.getFollowing(user.id)])
      .then(([nextFollowers, nextFollowing]) => {
        if (cancelled) return
        setFollowers(nextFollowers)
        setFollowedProfiles(nextFollowing)
      })
      .catch(() => {
        if (cancelled) return
        setFollowers([])
        setFollowedProfiles([])
      })

    return () => { cancelled = true }
  }, [user])

  if (!user) return null

  const publicPlaylists = savedPlaylists.filter((p) => p.isOwner && p.isPublic)
  const topTracks = likedSongs.slice(0, 5)
  const followedArtistIds = new Set(followedArtists.map((artist) => artist.id))
  const distinctProfileFollows = followedProfiles.filter(
    (profile) => !profile.artistId || !followedArtistIds.has(profile.artistId),
  )
  const followingCount = followedArtists.length + distinctProfileFollows.length

  const closeEdit = () => {
    setEditOpen(false)
    if (searchParams.get('edit')) {
      const next = new URLSearchParams(searchParams)
      next.delete('edit')
      setSearchParams(next, { replace: true })
    }
  }

  const copyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/user/${user.id}`)
      notify.success('Link copied to clipboard')
    } catch {
      notify.error('Could not copy profile link')
    }
  }

  return (
    <div>
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-80"
          style={{ background: profileGradient(heroColor) }}
        />
        <div className="relative flex flex-col items-center gap-6 px-6 pb-6 pt-16 sm:flex-row sm:items-end">
          <Avatar
            src={user.avatarUrl}
            alt={user.name}
            size="xl"
            round
            className="h-36 w-36 text-5xl shadow-2xl sm:h-52 sm:w-52"
          />
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-sm font-bold text-primary">{t('profile.eyebrow')}</p>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="group my-3 max-w-full text-left"
              aria-label={`Edit ${user.name} profile`}
            >
              <h1 className="break-words text-5xl font-black text-primary decoration-4 underline-offset-4 group-hover:underline sm:text-7xl">
                {user.name}
              </h1>
            </button>
            <div className="flex flex-wrap items-center justify-center gap-x-1 text-sm text-secondary sm:justify-start">
              <span>{t('profile.publicPlaylists', { n: publicPlaylists.length })}</span>
              <span aria-hidden>•</span>
              <button
                type="button"
                onClick={() => setFollowersOpen(true)}
                className="transition-colors hover:text-primary hover:underline"
              >
                {followers.length} {t('profile.followers')}
              </button>
              <span aria-hidden>•</span>
              <Link to="/following" className="transition-colors hover:text-primary hover:underline">
                {t('profile.following', { n: followingCount })}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 px-6 py-4">
        <Link
          to="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary"
          title={t('settings.title')}
          aria-label={t('settings.title')}
        >
          <Cog6ToothIcon className="h-6 w-6" />
        </Link>

        <Menu>
          <MenuButton
            className="flex h-9 w-9 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:bg-elevated hover:text-primary active:scale-95"
            aria-label="More profile options"
          >
            <EllipsisHorizontalIcon className="h-7 w-7 stroke-[2.5]" />
          </MenuButton>
          <MenuItems
            anchor="bottom start"
            modal={false}
            transition
            className="z-[1000] w-48 origin-top-left rounded-md bg-elevated p-1.5 text-sm text-primary shadow-2xl ring-1 ring-primary/10 [--anchor-gap:8px] focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            <MenuItem>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="flex min-h-10 w-full items-center gap-3 rounded px-3 py-2 font-semibold transition-colors data-[focus]:bg-surface"
              >
                <PencilIcon className="h-5 w-5 shrink-0" />
                {t('profile.edit')}
              </button>
            </MenuItem>
            <MenuItem>
              <button
                type="button"
                onClick={() => void copyProfileLink()}
                className="flex min-h-10 w-full items-center gap-3 rounded px-3 py-2 font-semibold transition-colors data-[focus]:bg-surface"
              >
                <Square2StackIcon className="h-5 w-5 shrink-0" />
                Copy link to profile
              </button>
            </MenuItem>
          </MenuItems>
        </Menu>
      </div>

      {followedArtists.length > 0 && (
        <section className="mb-8 px-6">
          <SectionHeader title={t('profile.topArtists')} href="/following?filter=artists" />
          <p className="-mt-3 mb-4 text-xs text-secondary">{t('profile.onlyVisible')}</p>
          <HorizontalScroller>
            {followedArtists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </HorizontalScroller>
        </section>
      )}

      {topTracks.length > 0 && (
        <section className="mb-8 px-4">
          <div className="px-2">
            <SectionHeader title={t('profile.topTracks')} />
            <p className="-mt-3 mb-2 text-xs text-secondary">{t('profile.onlyVisible')}</p>
          </div>
          {topTracks.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i} queue={topTracks} showAlbum />
          ))}
        </section>
      )}

      {publicPlaylists.length > 0 && (
        <section className="mb-8 px-6">
          <SectionHeader title={t('profile.publicPlaylistsHeader')} />
          <HorizontalScroller>
            {publicPlaylists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </HorizontalScroller>
        </section>
      )}

      <EditProfileModal open={editOpen} onClose={closeEdit} />
      <FollowListModal
        open={followersOpen}
        onClose={() => setFollowersOpen(false)}
        userId={user.id}
        mode="followers"
      />
    </div>
  )
}
