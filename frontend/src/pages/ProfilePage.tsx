import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Cog6ToothIcon, PencilIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { profileGradient, useDominantColor } from '@/hooks/useDominantColor'
import { Avatar } from '@/components/ui/Avatar'
import { ArtistCard } from '@/components/cards/ArtistCard'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { TrackRow } from '@/components/cards/TrackRow'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { SectionHeader } from '@/components/common/SectionHeader'
import { EditProfileModal } from '@/components/profile/EditProfileModal'
import { useTranslation } from '@/i18n/useTranslation'

export function ProfilePage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const { followedArtists, likedSongs, savedPlaylists, fetchLibrary } = useLibraryStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editOpen, setEditOpen] = useState(searchParams.get('edit') === '1')
  const heroColor = useDominantColor(user?.avatarUrl)

  useEffect(() => {
    fetchLibrary()
  }, [fetchLibrary])

  if (!user) return null

  const publicPlaylists = savedPlaylists.filter((p) => p.isOwner && p.isPublic)
  const topTracks = likedSongs.slice(0, 5)

  const closeEdit = () => {
    setEditOpen(false)
    if (searchParams.get('edit')) {
      const next = new URLSearchParams(searchParams)
      next.delete('edit')
      setSearchParams(next, { replace: true })
    }
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
            src={user.avatarUrl}
            alt={user.name}
            size="xl"
            round
            className="h-36 w-36 text-5xl shadow-2xl sm:h-52 sm:w-52"
          />
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-sm font-bold text-primary">{t('profile.eyebrow')}</p>
            <h1 className="my-3 break-words text-5xl font-black text-primary sm:text-7xl">{user.name}</h1>
            <p className="text-sm text-secondary">
              {t('profile.publicPlaylists', { n: publicPlaylists.length })} ·{' '}
              {t('profile.following', { n: followedArtists.length })}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-6 py-4">
        <Link
          to="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary"
          title={t('settings.title')}
          aria-label={t('settings.title')}
        >
          <Cog6ToothIcon className="h-6 w-6" />
        </Link>
        <button
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-secondary/50 px-5 py-2 text-sm font-bold text-primary transition-all hover:scale-105 hover:border-primary active:scale-95"
        >
          <PencilIcon className="h-4 w-4" />
          {t('profile.edit')}
        </button>
      </div>

      {/* Top artists */}
      {followedArtists.length > 0 && (
        <section className="mb-8 px-6">
          <SectionHeader title={t('profile.topArtists')} href="/library?tab=artists" />
          <p className="-mt-3 mb-4 text-xs text-secondary">{t('profile.onlyVisible')}</p>
          <HorizontalScroller>
            {followedArtists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </HorizontalScroller>
        </section>
      )}

      {/* Top tracks */}
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

      {/* Public playlists */}
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
    </div>
  )
}
