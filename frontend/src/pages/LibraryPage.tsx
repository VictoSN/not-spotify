import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useLibraryStore } from '@/stores/libraryStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { trackService } from '@/services/trackService'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { ArtistCard } from '@/components/cards/ArtistCard'
import { TrackRow } from '@/components/cards/TrackRow'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { PlusIcon, PlayIcon, ClockIcon, ArrowDownTrayIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import { useTranslation } from '@/i18n/useTranslation'

/** Shape produced by the playlist Export button on PlaylistDetailPage. */
interface ImportedPlaylist {
  name?: string
  description?: string | null
  tracks?: { title?: string; artist?: string }[]
}

type Filter = 'playlists' | 'albums' | 'artists' | 'liked'
type SortKey = 'recent' | 'az' | 'za'

/** 'recent' keeps API order (most recently added/updated first). */
function sortBy<T>(items: T[], sort: SortKey, name: (item: T) => string): T[] {
  if (sort === 'recent') return items
  return [...items].sort((a, b) =>
    sort === 'az' ? name(a).localeCompare(name(b)) : name(b).localeCompare(name(a)),
  )
}
export function LibraryPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('library.title'))
  const isMobile = useIsMobile()
  const { savedPlaylists, savedAlbums, followedArtists, likedSongs, likedAtMap, isLoading, fetchLibrary, createPlaylist, addTrackToPlaylist } =
    useLibraryStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const playWithGate = usePlaybackGate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') as Filter | null
  const filter: Filter = tab && ['playlists', 'albums', 'artists', 'liked'].includes(tab) ? tab : 'playlists'
  const setFilter = (f: Filter) => setSearchParams(f === 'playlists' ? {} : { tab: f })
  const [sort, setSort] = useState<SortKey>('recent')

  const sortedPlaylists = sortBy(savedPlaylists, sort, (p) => p.name)
  const sortedAlbums = sortBy(savedAlbums, sort, (a) => a.title)
  const sortedArtists = sortBy(followedArtists, sort, (a) => a.name)
  const sortedLiked = sortBy(likedSongs, sort, (t) => t.title)

  useEffect(() => {
    if (!isAuthenticated) return
    fetchLibrary()
  }, [fetchLibrary, isAuthenticated])

  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [smartOpen, setSmartOpen] = useState(false)
  const [smartName, setSmartName] = useState('My smart playlist')
  const [smartGenre, setSmartGenre] = useState('')
  const [smartRating, setSmartRating] = useState('')
  const [smartPlayCount, setSmartPlayCount] = useState('')
  const [smartDays, setSmartDays] = useState('')
  const [smartLimit, setSmartLimit] = useState('100')
  const [creatingSmart, setCreatingSmart] = useState(false)

  const handleCreatePlaylist = () => {
    if (!isAuthenticated) {
      openAuthPrompt({ title: t('library.auth.createTitle') })
      return
    }
    createPlaylist(t('library.newPlaylist'))
  }

  const handleImportClick = () => {
    if (!isAuthenticated) {
      openAuthPrompt({ title: t('library.auth.importTitle') })
      return
    }
    fileInputRef.current?.click()
  }

  const handleCreateSmartPlaylist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Create smart playlists with a free account' })
      return
    }
    const rules = {
      genre: smartGenre.trim() || null,
      minimumRating: smartRating ? Number(smartRating) : null,
      minimumPlayCount: smartPlayCount ? Number(smartPlayCount) : null,
      addedWithinDays: smartDays ? Number(smartDays) : null,
      limit: Number(smartLimit) || 100,
    }
    if (!rules.genre && rules.minimumRating === null && rules.minimumPlayCount === null && rules.addedWithinDays === null) {
      setImportMsg('Choose at least one smart playlist rule.')
      return
    }
    setCreatingSmart(true)
    setImportMsg(null)
    try {
      const playlist = await createPlaylist(smartName.trim() || 'My smart playlist', undefined, true, rules)
      setSmartOpen(false)
      navigate(`/playlist/${playlist.id}`)
    } catch {
      setImportMsg('Could not create the smart playlist.')
    } finally {
      setCreatingSmart(false)
    }
  }

  // Import a playlist exported as JSON: create it, then match each entry to a
  // catalog track by title (+ artist) and add the ones we find.
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file
    if (!file) return

    setImporting(true)
    setImportMsg(null)
    try {
      const data = JSON.parse(await file.text()) as ImportedPlaylist
      const entries = Array.isArray(data.tracks) ? data.tracks : []
      const playlist = await createPlaylist(data.name?.trim() || t('library.import.defaultName'), data.description ?? undefined, false)

      let matched = 0
      for (const entry of entries) {
        const title = entry.title?.trim()
        if (!title) continue
        try {
          const results = await trackService.search(title)
          if (results.length === 0) continue
          const wantArtist = entry.artist?.trim().toLowerCase()
          const best = (wantArtist && results.find((t) => t.artist.name.toLowerCase() === wantArtist)) || results[0]
          await addTrackToPlaylist(playlist.id, best)
          matched++
        } catch {
          // skip unmatched / network blip
        }
      }

      setImportMsg(t('library.import.success', { name: playlist.name, matched, total: entries.length }))
      navigate(`/playlist/${playlist.id}`)
    } catch {
      setImportMsg(t('library.import.error'))
    } finally {
      setImporting(false)
    }
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'playlists', label: t('library.filter.playlists'), count: savedPlaylists.length },
    { key: 'albums', label: t('library.filter.albums'), count: savedAlbums.length },
    { key: 'artists', label: t('library.filter.artists'), count: followedArtists.length },
    { key: 'liked', label: t('library.filter.liked'), count: likedSongs.length },
  ]

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-primary">{t('library.title')}</h1>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleImportClick}
            disabled={importing}
            aria-label={t('library.import.aria')}
            title={t('library.import.aria')}
          >
            {importing ? <Spinner size="sm" /> : <ArrowDownTrayIcon className="w-5 h-5" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSmartOpen((open) => !open)}
            aria-label="Create smart playlist"
            title="Create smart playlist"
          >
            <SparklesIcon className="w-5 h-5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={handleCreatePlaylist} aria-label={t('library.createPlaylist')}>
            <PlusIcon className="w-5 h-5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      {importMsg && (
        <div className="mb-4 rounded-md border border-elevated/50 bg-surface px-4 py-2.5 text-sm text-primary">
          {importMsg}
        </div>
      )}

      {smartOpen && (
        <form onSubmit={handleCreateSmartPlaylist} className="mb-6 rounded-xl border border-accent/20 bg-surface p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-primary">Create smart playlist</h2>
              <p className="text-xs text-secondary">Tracks update automatically when they match every selected rule.</p>
            </div>
            <button type="button" onClick={() => setSmartOpen(false)} className="text-secondary hover:text-primary" aria-label="Close">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1 text-xs font-semibold text-secondary">
              Name
              <input value={smartName} onChange={(e) => setSmartName(e.target.value)} required className="h-10 rounded-md bg-elevated px-3 text-sm text-primary outline-none focus:ring-1 focus:ring-accent" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-secondary">
              Genre slug
              <input value={smartGenre} onChange={(e) => setSmartGenre(e.target.value)} placeholder="rock" className="h-10 rounded-md bg-elevated px-3 text-sm text-primary outline-none focus:ring-1 focus:ring-accent" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-secondary">
              Minimum rating
              <select value={smartRating} onChange={(e) => setSmartRating(e.target.value)} className="h-10 rounded-md bg-elevated px-3 text-sm text-primary outline-none focus:ring-1 focus:ring-accent">
                <option value="">Any rating</option>
                <option value="3">3+ stars</option>
                <option value="4">4+ stars</option>
                <option value="4.5">4.5+ stars</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-secondary">
              Minimum plays
              <input type="number" min="0" value={smartPlayCount} onChange={(e) => setSmartPlayCount(e.target.value)} placeholder="Any" className="h-10 rounded-md bg-elevated px-3 text-sm text-primary outline-none focus:ring-1 focus:ring-accent" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-secondary">
              Added recently
              <select value={smartDays} onChange={(e) => setSmartDays(e.target.value)} className="h-10 rounded-md bg-elevated px-3 text-sm text-primary outline-none focus:ring-1 focus:ring-accent">
                <option value="">Any time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-secondary">
              Maximum tracks
              <input type="number" min="1" max="500" value={smartLimit} onChange={(e) => setSmartLimit(e.target.value)} className="h-10 rounded-md bg-elevated px-3 text-sm text-primary outline-none focus:ring-1 focus:ring-accent" />
            </label>
          </div>
          <Button type="submit" className="mt-4 gap-2" disabled={creatingSmart}>
            <SparklesIcon className="h-4 w-4" />
            {creatingSmart ? 'Creating…' : 'Create smart playlist'}
          </Button>
        </form>
      )}

      {/* Filter chips + sort */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {filters.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              filter === key ? 'bg-primary text-page' : 'bg-elevated text-secondary hover:text-primary'
            }`}
          >
            {label}
            {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
          </button>
        ))}
        <select
          aria-label={t('library.sort.aria')}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="ml-auto rounded-md border border-secondary/20 bg-elevated px-3 py-1.5 text-sm font-medium text-primary outline-none transition-colors hover:border-secondary/40 focus:border-accent"
        >
          <option value="recent">{t('sort.recentlyAdded')}</option>
          <option value="az">{t('sort.az')}</option>
          <option value="za">{t('sort.za')}</option>
        </select>
      </div>

      {/* Content */}
      {filter === 'playlists' &&
        (savedPlaylists.length === 0 ? (
          <EmptyState
            title={t('library.empty.playlists.title')}
            description={t('library.empty.playlists.sub')}
            action={
              <Button onClick={handleCreatePlaylist} className="gap-2">
                <PlusIcon className="w-4 h-4" /> {t('library.createPlaylist')}
              </Button>
            }
          />
        ) : (
          <div className="flex flex-wrap gap-4">
            {sortedPlaylists.map((p) => (
              <PlaylistCard key={p.id} playlist={p} />
            ))}
          </div>
        ))}

      {filter === 'albums' &&
        (savedAlbums.length === 0 ? (
          <EmptyState title={t('library.empty.albums.title')} description={t('library.empty.albums.sub')} />
        ) : (
          <div className="flex flex-wrap gap-4">
            {sortedAlbums.map((a) => (
              <AlbumCard key={a.id} album={a} />
            ))}
          </div>
        ))}

      {filter === 'artists' &&
        (followedArtists.length === 0 ? (
          <EmptyState title={t('library.empty.artists.title')} description={t('library.empty.artists.sub')} />
        ) : (
          <div className="flex flex-wrap gap-4">
            {sortedArtists.map((a) => (
              <ArtistCard key={a.id} artist={a} />
            ))}
          </div>
        ))}

      {filter === 'liked' &&
        (likedSongs.length === 0 ? (
          <EmptyState title={t('library.empty.liked.title')} description={t('library.empty.liked.sub')} />
        ) : (
          <div>
            {/* Playlist-style header */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 pb-4 sm:pb-6 bg-gradient-to-b from-accent-dim/40 to-transparent rounded-lg mb-4 p-4">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-md shadow-2xl flex-shrink-0 bg-accent/20 flex items-center justify-center self-center sm:self-auto">
                <HeartSolid className="w-12 h-12 sm:w-16 sm:h-16 text-accent" />
              </div>
              <div className="min-w-0 pb-1 text-center sm:text-left">
                <p className="text-xs font-semibold text-secondary uppercase tracking-wider">{t('sidebar.playlist')}</p>
                <h2 className="text-3xl sm:text-4xl font-black text-primary mt-1 mb-2">{t('library.likedSongs')}</h2>
                <p className="text-xs text-secondary">{t('library.songCount', { n: likedSongs.length })}</p>
              </div>
            </div>

            {/* Play button */}
            <div className="flex items-center gap-4 mb-4">
              <Button
                onClick={() => playWithGate(likedSongs[0], likedSongs)}
                size="lg"
                className="gap-2"
              >
                <PlayIcon className="w-5 h-5" />
                {t('common.play')}
              </Button>
            </div>

            {/* Column headers */}
            <div
              className="grid items-center gap-4 px-4 py-2 border-b border-elevated/30 mb-2"
              style={{ gridTemplateColumns: isMobile ? '16px 1fr var(--track-actions-width)' : '16px 6fr 4fr 3fr var(--track-actions-width)' }}
            >
              <span className="text-xs text-secondary">#</span>
              <span className="text-xs text-secondary uppercase tracking-wider">{t('library.column.title')}</span>
              <span className="text-xs text-secondary uppercase tracking-wider hidden md:block">{t('library.column.album')}</span>
              <span className="text-xs text-secondary uppercase tracking-wider hidden md:block">{t('library.column.dateAdded')}</span>
              <div className="grid grid-cols-[32px_50px_32px] sm:grid-cols-[80px_32px_50px_32px] items-center gap-1.5 sm:gap-2 justify-end w-[114px] sm:w-[194px] ml-auto">
                <span className="hidden sm:block" />
                <span />
                <span className="flex justify-end pr-1">
                  <ClockIcon className="w-4 h-4 text-secondary" />
                </span>
                <span />
              </div>
            </div>

            {sortedLiked.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
                queue={sortedLiked}
                showAlbum
                addedAt={likedAtMap[track.id]}
              />
            ))}
          </div>
        ))}
    </div>
  )
}
