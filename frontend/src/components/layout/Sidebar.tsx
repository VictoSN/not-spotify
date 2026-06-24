import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { CollapseIcon } from '@/components/common/CollapseIcon'
import { PinIcon } from '@/components/icons/PinIcon'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ListBulletIcon,
  Squares2X2Icon,
  CheckIcon,
  FolderIcon,
  FolderPlusIcon,
  MusicalNoteIcon,
  EllipsisHorizontalIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { HeartIcon, PlayIcon } from '@heroicons/react/24/solid'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useUiStore } from '@/stores/uiStore'
import { useRatingStore } from '@/stores/ratingStore'
import { getPinnedSet, togglePinned, PINNED_EVENT } from '@/utils/pinnedLibrary'
import { useTranslation } from '@/i18n/useTranslation'
import type { Track } from '@/types/track'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { Playlist } from '@/types/playlist'
import { PlaylistMenu, type PlaylistMenuHandle } from '@/components/cards/PlaylistMenu'
import { artistService } from '@/services/artistService'
import { trackService } from '@/services/trackService'
import { useDragStore } from '@/stores/dragStore'
import { useTrackDrop } from '@/hooks/useTrackDrop'
import { useLibraryDrop } from '@/hooks/useLibraryDrop'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { DROP_GREEN } from '@/utils/trackDnd'
import { notify } from '@/utils/toast'
import {
  type LibraryFolder,
  getFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  setFolderCollapsed,
  addItemToFolder,
  removeItemFromFolder,
  folderOfItem,
  FOLDERS_EVENT,
} from '@/utils/libraryFolders'
import { cn } from '@/utils/cn'

const RAIL = 72
const DEFAULT_W = 300
const MIN_W = 280 // narrowest expanded width before snapping to the rail
const MAX_W = 420
const SNAP_THRESHOLD = 220 // drag below this → collapse to the icon rail
const STORAGE_KEY = 'ns-sidebar-width'
const COMPACT_LIBRARY_KEY = 'ns-pref-compact'

type Filter = 'all' | 'playlists' | 'artists' | 'albums'
type Sort = 'recents' | 'recentlyAdded' | 'alpha' | 'creator' | 'custom'

const SORT_OPTIONS: { key: Sort; tKey: string }[] = [
  { key: 'recents', tKey: 'sort.recents' },
  { key: 'recentlyAdded', tKey: 'sort.recentlyAdded' },
  { key: 'alpha', tKey: 'sort.alpha' },
  { key: 'creator', tKey: 'sort.creator' },
  { key: 'custom', tKey: 'sort.custom' },
]

interface LibItem {
  key: string
  id: string
  kind: 'playlist' | 'album' | 'artist'
  name: string
  subtitle: string
  image: string | null
  round: boolean
  to: string
  /** True for playlists the user owns — the only library rows a track can be dropped onto. */
  acceptsTracks: boolean
}

interface SidebarProps {
  takeoverHidden?: boolean
}

function getInitialWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_W
  const stored = Number(window.localStorage.getItem(STORAGE_KEY))
  if (!stored || Number.isNaN(stored)) return DEFAULT_W
  return stored <= RAIL ? RAIL : Math.min(Math.max(stored, MIN_W), MAX_W)
}

function getInitialCompactLibrary(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return JSON.parse(window.localStorage.getItem(COMPACT_LIBRARY_KEY) ?? 'false') === true
  } catch {
    return false
  }
}

function albumKindLabel(type: Album['type']): string {
  if (type === 'single') return 'Single'
  if (type === 'ep') return 'EP'
  if (type === 'compilation') return 'Compilation'
  return 'Album'
}

export function Sidebar({ takeoverHidden = false }: SidebarProps) {
  const navigate = useNavigate()
  const {
    savedPlaylists,
    savedAlbums,
    savedAlbumIds,
    followedArtists,
    followedArtistIds,
    likedSongs,
    createPlaylist,
    fetchLibrary,
    followArtist,
    saveAlbum,
  } = useLibraryStore()
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist)
  const likeTrack = useLibraryStore((s) => s.likeTrack)
  const likedTrackIds = useLibraryStore((s) => s.likedTrackIds)
  const loadRatings = useRatingStore((s) => s.loadFromBackend)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const playWithGate = usePlaybackGate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const { t } = useTranslation()

  const [width, setWidth] = useState(getInitialWidth)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recents')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('ns-library-view') === 'grid' ? 'grid' : 'list',
  )
  const [compactLibrary, setCompactLibrary] = useState(getInitialCompactLibrary)
  const [pinned, setPinned] = useState<Set<string>>(getPinnedSet)
  const [folders, setFolders] = useState<LibraryFolder[]>(getFolders)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [rowMenuKey, setRowMenuKey] = useState<string | null>(null)
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const libraryExpanded = useUiStore((s) => s.libraryExpanded)
  const setLibraryExpanded = useUiStore((s) => s.setLibraryExpanded)
  const libraryDragActive = useDragStore(
    (s) => !!s.draggedTrack || !!s.draggedArtist || !!s.draggedAlbum,
  )

  const setView = (v: 'list' | 'grid') => {
    setViewMode(v)
    try {
      window.localStorage.setItem('ns-library-view', v)
    } catch {
      /* ignore */
    }
  }

  const collapsed = width <= RAIL
  const grid = libraryExpanded || viewMode === 'grid'
  const compactCreateButton = !libraryExpanded && width < 292

  // Populate the library app-wide (today only LibraryPage triggers this).
  useEffect(() => {
    if (!isAuthenticated) return
    fetchLibrary()
    loadRatings()
  }, [fetchLibrary, loadRatings, isAuthenticated])

  // Persist width
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(width))
  }, [width])

  useEffect(() => {
    const syncFromStorage = () => setCompactLibrary(getInitialCompactLibrary())
    const handlePrefChange = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; value?: unknown }>).detail
      if (detail?.key === COMPACT_LIBRARY_KEY) setCompactLibrary(detail.value === true)
    }
    window.addEventListener('storage', syncFromStorage)
    window.addEventListener('ns-pref-change', handlePrefChange)
    return () => {
      window.removeEventListener('storage', syncFromStorage)
      window.removeEventListener('ns-pref-change', handlePrefChange)
    }
  }, [])

  // Keep pinned items in step across tabs/views (the toggle lives on each row).
  useEffect(() => {
    const sync = () => setPinned(getPinnedSet())
    window.addEventListener(PINNED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PINNED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  // Keep folders in step (created/edited from the row + folder menus).
  useEffect(() => {
    const sync = () => setFolders(getFolders())
    window.addEventListener(FOLDERS_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(FOLDERS_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  // ── Drag to resize ──────────────────────────────────────────────
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startW: collapsed ? RAIL : width }
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const next = dragRef.current.startW + (e.clientX - dragRef.current.startX)
      // Snap straight to the rail instead of letting the header text truncate.
      if (next < SNAP_THRESHOLD) setWidth(RAIL)
      else setWidth(Math.min(Math.max(next, MIN_W), MAX_W))
    }
    const onUp = () => setDragging(false)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  const handleCreate = async () => {
    if (!isAuthenticated) {
      openAuthPrompt({ title: t('sidebar.auth.createPromptTitle') })
      return
    }
    const playlist = await createPlaylist(t('sidebar.defaultPlaylistName', { n: savedPlaylists.length + 1 }))
    navigate(`/playlist/${playlist.id}`)
  }

  // ── Drop a dragged track onto a playlist / Liked Songs ──────────
  const dropTrackOnPlaylist = async (playlistId: string, track: Track) => {
    try {
      await addTrackToPlaylist(playlistId, track)
      notify.success('Added to playlist')
    } catch (error) {
      // 409 = already in the playlist (the backend rejects duplicates).
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 409) notify.info('Already in this playlist')
      else notify.error("Couldn't add to playlist")
    }
  }

  const dropTrackOnLiked = (track: Track) => {
    if (likedTrackIds.has(track.id)) {
      notify.info('Already in your Liked Songs')
      return
    }
    likeTrack(track)
    notify.success('Added to Liked Songs')
  }

  const dropArtistOnLibrary = async (artist: Artist) => {
    if (followedArtistIds.has(artist.id)) {
      notify.info('Already in Your Library')
      return
    }
    await followArtist(artist)
    notify.success('Added artist to Your Library')
  }

  const dropAlbumOnLibrary = async (album: Album) => {
    if (savedAlbumIds.has(album.id)) {
      notify.info('Already in Your Library')
      return
    }
    await saveAlbum(album)
    notify.success('Saved to Your Library')
  }

  // The whole library surface is a drop target, so tracks, artists, albums, and
  // singles can be saved regardless of filters or scroll position.
  const libraryDrop = useLibraryDrop(isAuthenticated, {
    onDropTrack: dropTrackOnLiked,
    onDropArtist: dropArtistOnLibrary,
    onDropAlbum: dropAlbumOnLibrary,
  })

  // ── Build the library list ──────────────────────────────────────
  const items = useMemo<LibItem[]>(() => {
    const playlists: LibItem[] = savedPlaylists.map((p) => ({
      key: `pl-${p.id}`,
      id: p.id,
      kind: 'playlist',
      name: p.name,
      subtitle: t('sidebar.subtitle.playlist', {
        owner: p.isOwner ? t('sidebar.you') : (p.owner?.name ?? t('sidebar.unknown')),
      }),
      image: p.coverUrl,
      round: false,
      to: `/playlist/${p.id}`,
      acceptsTracks: !!p.isOwner,
    }))
    const albums: LibItem[] = savedAlbums.map((a) => ({
      key: `al-${a.id}`,
      id: a.id,
      kind: 'album',
      name: a.title,
      subtitle: `${albumKindLabel(a.type)} • ${a.artist.name}`,
      image: a.coverUrl,
      round: false,
      to: `/album/${a.id}`,
      acceptsTracks: false,
    }))
    const artists: LibItem[] = followedArtists.map((a) => ({
      key: `ar-${a.id}`,
      id: a.id,
      kind: 'artist',
      name: a.name,
      subtitle: t('sidebar.kind.artist'),
      image: a.imageUrl,
      round: true,
      to: `/artist/${a.id}`,
      acceptsTracks: false,
    }))

    let list =
      filter === 'playlists'
        ? playlists
        : filter === 'albums'
          ? albums
          : filter === 'artists'
            ? artists
            : [...playlists, ...albums, ...artists]

    const q = query.trim().toLowerCase()
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q))
    if (sort === 'alpha') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'creator') list = [...list].sort((a, b) => a.subtitle.localeCompare(b.subtitle))
    // Pinned items float to the top, keeping their order among the rest.
    if (pinned.size) {
      list = [...list.filter((i) => pinned.has(i.key)), ...list.filter((i) => !pinned.has(i.key))]
    }
    return list
  }, [savedPlaylists, savedAlbums, followedArtists, filter, query, sort, pinned, t])

  const likedSongsQuery = t('sidebar.likedSongs').toLowerCase()
  const showLiked =
    (filter === 'all' || filter === 'playlists') &&
    (!query.trim() ||
      'liked songs'.includes(query.trim().toLowerCase()) ||
      likedSongsQuery.includes(query.trim().toLowerCase()))

  const isNowPlaying = (item: LibItem) =>
    !!currentTrack &&
    ((item.kind === 'album' && currentTrack.album.id === item.id) ||
      (item.kind === 'artist' && currentTrack.artist.id === item.id))

  const playLikedSongs = () => {
    if (likedSongs.length === 0) {
      notify.info('No liked songs yet')
      return
    }
    playWithGate(likedSongs[0], likedSongs)
  }

  const playLibraryItem = async (item: LibItem) => {
    try {
      if (item.kind === 'playlist') {
        const playlist = savedPlaylists.find((p) => p.id === item.id)
        const tracks = (playlist?.tracks ?? []).map((row) => row.track)
        if (tracks.length > 0) playWithGate(tracks[0], tracks)
        else notify.info('No tracks in this playlist yet')
        return
      }

      if (item.kind === 'album') {
        const tracks = await trackService.getByAlbum(item.id)
        if (tracks.length > 0) playWithGate(tracks[0], tracks)
        else notify.info('No tracks available for this release yet')
        return
      }

      const tracks = await artistService.getTopTracks(item.id, 20)
      if (tracks.length > 0) playWithGate(tracks[0], tracks)
      else notify.info('No tracks available for this artist yet')
    } catch {
      notify.error("Couldn't start playback")
    }
  }

  // ── Folders (a client-side grouping layer over `items`) ─────────
  const itemByKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items])
  const folderItemKeys = useMemo(() => new Set(folders.flatMap((f) => f.itemKeys)), [folders])
  // Folders only surface in the default view (no active filter/search), so the
  // flat filtered list stays predictable when searching.
  const foldersActive = filter === 'all' && !query.trim()
  const ungroupedItems = foldersActive ? items.filter((i) => !folderItemKeys.has(i.key)) : items
  const hasFolderSection = foldersActive && folders.length > 0

  const handleCreateFolder = () => {
    const folder = createFolder()
    // Clear any filter/search so the new (empty) folder is visible, then rename.
    setFilter('all')
    setQuery('')
    setRenamingFolderId(folder.id)
    setRenameValue(folder.name)
  }

  const commitRename = (id: string) => {
    renameFolder(id, renameValue)
    setRenamingFolderId(null)
  }

  const frameStyle: React.CSSProperties = {
    flexBasis: takeoverHidden ? 0 : collapsed ? RAIL : width,
    flexGrow: takeoverHidden ? 0 : libraryExpanded ? 1 : 0,
    flexShrink: 0,
  }
  const frameClass = cn(
    'group/sidebar relative min-w-0 rounded-lg bg-sidebar flex flex-col overflow-hidden select-none',
    // Animate width (rail/drag) but expand instantly — a growing grid reflows columns and looks glitchy.
    !dragging && 'transition-[flex-basis,opacity,transform] duration-300 ease-out',
    takeoverHidden ? 'pointer-events-none -translate-x-4 opacity-0' : 'translate-x-0 opacity-100',
  )

  // ── Rail (collapsed) ────────────────────────────────────────────
  if (!isAuthenticated && collapsed) {
    return (
      <aside style={frameStyle} className={frameClass}>
        <button
          onClick={() => setWidth(DEFAULT_W)}
          className="m-3 w-12 h-12 rounded-md flex items-center justify-center text-secondary hover:text-primary hover:bg-elevated hover:scale-105 transition-all"
          aria-label={t('sidebar.expand')}
          title={t('sidebar.expand')}
        >
          <CollapseIcon className="h-6 w-6" />
        </button>

        <DragHandle onMouseDown={onDragStart} />
      </aside>
    )
  }

  if (!isAuthenticated) {
    return (
      <aside style={frameStyle} className={frameClass}>
        <div className="group/library-header flex items-center justify-between px-4 pt-3 pb-3 gap-2">
          <div className="relative flex min-w-0 items-center">
            <button
              onClick={() => setWidth(RAIL)}
              className="spotify-tooltip-anchor absolute left-0 z-10 -translate-x-1 text-secondary opacity-0 transition-all duration-200 hover:scale-110 hover:text-primary group-hover/library-header:translate-x-0 group-hover/library-header:opacity-100"
              aria-label={t('sidebar.collapse')}
            >
              <CollapseIcon className="h-5 w-5 -scale-x-100" />
              <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-left">{t('sidebar.collapse')}</span>
            </button>
            <span className="truncate pl-0 text-base font-black leading-5 text-primary transition-all duration-200 group-hover/library-header:pl-7">
              {t('sidebar.title')}
            </span>
          </div>
          <button
            onClick={handleCreate}
            className={cn(
              'spotify-tooltip-anchor relative flex h-8 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-black text-primary transition-all hover:scale-105 hover:bg-elevated/70 active:scale-95',
              compactCreateButton ? 'w-8 px-0' : 'gap-1.5 pl-2 pr-3',
            )}
            aria-label={t('sidebar.createAria')}
          >
            <PlusIcon className="h-[18px] w-[18px] stroke-[2]" />
            {!compactCreateButton && <span>{t('sidebar.create')}</span>}
            <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-right">
              {t('sidebar.createTooltip')}
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="flex flex-col gap-3">
            <section className="rounded-lg bg-elevated p-4">
              <h2 className="text-sm font-bold text-primary">{t('sidebar.auth.createTitle')}</h2>
              <p className="mt-2 text-xs font-semibold text-primary">{t('sidebar.auth.createSub')}</p>
              <button
                onClick={() => openAuthPrompt({ title: t('sidebar.auth.createPromptTitle') })}
                className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-bold text-page transition-transform hover:scale-105 active:scale-95"
              >
                {t('sidebar.auth.createButton')}
              </button>
            </section>

            <section className="rounded-lg bg-elevated p-4">
              <h2 className="text-sm font-bold text-primary">{t('sidebar.auth.podcastsTitle')}</h2>
              <p className="mt-2 text-xs font-semibold text-primary">{t('sidebar.auth.podcastsSub')}</p>
              <button
                onClick={() => openAuthPrompt({ title: t('sidebar.auth.podcastsPromptTitle') })}
                className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-bold text-page transition-transform hover:scale-105 active:scale-95"
              >
                {t('sidebar.auth.podcastsButton')}
              </button>
            </section>
          </div>
        </div>

        <DragHandle onMouseDown={onDragStart} />
      </aside>
    )
  }

  if (collapsed && !libraryExpanded) {
    return (
      <aside
        {...libraryDrop.dropProps}
        style={
          libraryDrop.isOver
            ? { ...frameStyle, boxShadow: `inset 0 0 0 2px ${DROP_GREEN}`, backgroundColor: `${DROP_GREEN}1a` }
            : frameStyle
        }
        className={frameClass}
      >
        <button
          onClick={() => setWidth(DEFAULT_W)}
          className="m-3 w-12 h-12 rounded-md flex items-center justify-center text-secondary hover:text-primary hover:bg-elevated hover:scale-105 transition-all"
          aria-label={t('sidebar.expand')}
          title={t('sidebar.expand')}
        >
          <CollapseIcon className="h-6 w-6" />
        </button>

        <div
          className={cn(
            'flex-1 overflow-y-auto px-3 pb-3 flex flex-col items-center gap-3 scrollbar-hide transition-opacity duration-150',
            libraryDrop.isOver && libraryDragActive && 'opacity-[0.45]',
          )}
        >
          <Link
            to="/library?tab=liked"
            title={t('sidebar.likedSongs')}
            className="w-12 h-12 rounded-md bg-gradient-to-br from-purple-600 to-indigo-300 flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
          >
            <HeartIcon className="w-5 h-5 text-white" />
          </Link>
          {items.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              title={item.name}
              className={cn(
                'w-12 h-12 shrink-0 overflow-hidden bg-elevated flex items-center justify-center hover:scale-105 transition-transform',
                item.round ? 'rounded-full' : 'rounded-md',
              )}
            >
              {item.image ? (
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">{item.kind === 'artist' ? '🎤' : '🎵'}</span>
              )}
            </Link>
          ))}
        </div>

        <DragHandle onMouseDown={onDragStart} />
      </aside>
    )
  }

  // ── Expanded ────────────────────────────────────────────────────
  const chips: { key: Filter; label: string }[] = [
    { key: 'playlists', label: t('sidebar.filter.playlists') },
    { key: 'artists', label: t('sidebar.filter.artists') },
    { key: 'albums', label: t('sidebar.filter.albums') },
  ]

  return (
    <aside
      {...libraryDrop.dropProps}
      style={
        libraryDrop.isOver
          ? { ...frameStyle, boxShadow: `inset 0 0 0 2px ${DROP_GREEN}`, backgroundColor: `${DROP_GREEN}1a` }
          : frameStyle
      }
      className={frameClass}
    >
      {/* Header */}
      <div className="group/library-header flex items-center justify-between px-4 pt-3 pb-3 gap-2 rounded-md transition-[box-shadow,background-color] duration-150">
        <div className="relative flex min-w-0 items-center">
          {!libraryExpanded && (
            <button
              onClick={() => setWidth(RAIL)}
              className="spotify-tooltip-anchor absolute left-0 z-10 -translate-x-1 text-secondary opacity-0 transition-all duration-200 hover:scale-110 hover:text-primary group-hover/library-header:translate-x-0 group-hover/library-header:opacity-100"
              aria-label={t('sidebar.collapse')}
            >
              <CollapseIcon className="h-5 w-5 -scale-x-100" />
              <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-left">{t('sidebar.collapse')}</span>
            </button>
          )}
          <span
            className={cn(
              'truncate pl-0 text-base font-black leading-5 text-primary transition-all duration-200',
              !libraryExpanded && 'group-hover/library-header:pl-7',
            )}
          >
            {t('sidebar.title')}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <button
              onClick={() => setCreateMenuOpen((v) => !v)}
              className={cn(
                'spotify-tooltip-anchor relative flex h-8 items-center justify-center rounded-full bg-elevated text-xs font-black text-primary transition-all hover:scale-105 hover:bg-elevated/70 active:scale-95',
                compactCreateButton ? 'w-8 px-0' : 'gap-1.5 pl-2 pr-3',
              )}
              aria-label={t('sidebar.createAria')}
              aria-haspopup="menu"
              aria-expanded={createMenuOpen}
            >
              <PlusIcon className="h-[18px] w-[18px] stroke-[2]" />
              {!compactCreateButton && <span>{t('sidebar.create')}</span>}
              {!createMenuOpen && (
                <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-right">
                  {t('sidebar.createTooltip')}
                </span>
              )}
            </button>
            {createMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCreateMenuOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-md border border-secondary/10 bg-elevated py-1 shadow-xl">
                  <button
                    onClick={() => {
                      setCreateMenuOpen(false)
                      handleCreate()
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-surface"
                  >
                    <MusicalNoteIcon className="h-4 w-4 shrink-0 text-secondary" /> {t('sidebar.playlist')}
                  </button>
                  <button
                    onClick={() => {
                      setCreateMenuOpen(false)
                      handleCreateFolder()
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-surface"
                  >
                    <FolderPlusIcon className="h-4 w-4 shrink-0 text-secondary" /> {t('sidebar.folder')}
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setLibraryExpanded(!libraryExpanded)}
            className="spotify-tooltip-anchor relative rounded-full p-1.5 text-secondary transition-all hover:scale-110 hover:bg-elevated hover:text-primary active:scale-90"
            aria-label={libraryExpanded ? t('sidebar.minimize') : t('sidebar.expand')}
          >
            {libraryExpanded ? <DiagonalCollapseIcon /> : <DiagonalExpandIcon />}
            <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-right">
              {libraryExpanded ? t('sidebar.minimize') : t('sidebar.expand')}
            </span>
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
        {filter !== 'all' && (
          <button
            onClick={() => setFilter('all')}
            className="w-6 h-6 rounded-full bg-elevated hover:bg-elevated/70 text-primary flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 transition-all"
            aria-label={t('sidebar.clearFilter')}
          >
            <XMarkIcon className="w-3.5 h-3.5" />
          </button>
        )}
        {chips
          .filter((c) => filter === 'all' || filter === c.key)
          .map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(filter === c.key ? 'all' : c.key)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-95',
                filter === c.key
                  ? 'bg-primary text-page'
                  : 'bg-elevated text-primary hover:bg-elevated/70',
              )}
            >
              {c.label}
            </button>
          ))}
      </div>

      {/* Search + sort */}
      <div className="flex h-9 items-center justify-between gap-2 px-4 pb-2">
        {searchOpen ? (
          <div
            className={cn('library-search-field relative', libraryExpanded ? 'w-full max-w-sm flex-none' : 'flex-1')}
          >
            <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => {
                if (!query) setSearchOpen(false)
              }}
              placeholder={t('sidebar.search')}
              className="h-8 w-full rounded-full border border-transparent bg-elevated pl-8 pr-3 text-xs font-semibold text-primary transition-[background-color,border-color,box-shadow] duration-200 placeholder:font-semibold placeholder:text-muted focus:border-accent focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent/70"
            />
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="text-secondary hover:text-primary hover:scale-110 active:scale-90 p-1.5 rounded-full hover:bg-elevated transition-all"
            aria-label={t('sidebar.search')}
            title={t('sidebar.search')}
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
          </button>
        )}
        <div className="relative shrink-0">
          <button
            onClick={() => setSortMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-primary hover:scale-105 active:scale-95 transition-all px-1"
            title={t('sidebar.sort')}
            aria-haspopup="menu"
            aria-expanded={sortMenuOpen}
          >
            {t(SORT_OPTIONS.find((o) => o.key === sort)?.tKey ?? 'sort.recents')}
            {viewMode === 'grid' ? <Squares2X2Icon className="w-4 h-4" /> : <ListBulletIcon className="w-4 h-4" />}
          </button>
          {sortMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSortMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 rounded-md border border-secondary/10 bg-elevated py-1 shadow-xl z-50">
                <p className="px-3 pb-1 pt-2 text-xs font-bold text-secondary">{t('sidebar.sortBy')}</p>
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => { setSort(o.key); setSortMenuOpen(false) }}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-surface"
                  >
                    <span className={cn(sort === o.key ? 'font-semibold text-accent' : 'text-primary')}>{t(o.tKey)}</span>
                    {sort === o.key && <CheckIcon className="h-4 w-4 text-accent" />}
                  </button>
                ))}
                <div className="my-1 border-t border-secondary/10" />
                <p className="px-3 pb-1 pt-1 text-xs font-bold text-secondary">{t('sidebar.viewAs')}</p>
                <div className="flex items-center gap-1 px-2 pb-2">
                  <button
                    onClick={() => { setView('list'); setSortMenuOpen(false) }}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors',
                      viewMode === 'list' ? 'bg-surface text-primary' : 'text-secondary hover:text-primary',
                    )}
                  >
                    <ListBulletIcon className="h-4 w-4" /> {t('sidebar.view.list')}
                  </button>
                  <button
                    onClick={() => { setView('grid'); setSortMenuOpen(false) }}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors',
                      viewMode === 'grid' ? 'bg-surface text-primary' : 'text-secondary hover:text-primary',
                    )}
                  >
                    <Squares2X2Icon className="h-4 w-4" /> {t('sidebar.view.grid')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Folders + library list/grid */}
      <div
        key={libraryExpanded ? 'expanded' : 'normal'}
        className={cn(
          'flex-1 overflow-y-auto px-2 pb-2 animate-fade-in transition-opacity duration-150',
          libraryDrop.isOver && libraryDragActive && 'opacity-[0.45]',
        )}
      >
        {hasFolderSection && (
          <div className="mb-1 flex flex-col">
            {folders.map((folder) => (
              <FolderGroup
                key={folder.id}
                folder={folder}
                contents={folder.itemKeys.map((k) => itemByKey.get(k)).filter((i): i is LibItem => !!i)}
                compact={compactLibrary}
                folders={folders}
                playlists={savedPlaylists}
                isNowPlaying={isNowPlaying}
                renaming={renamingFolderId === folder.id}
                renameValue={renameValue}
                onRenameChange={setRenameValue}
                onRenameStart={() => {
                  setRenamingFolderId(folder.id)
                  setRenameValue(folder.name)
                }}
                onRenameCommit={() => commitRename(folder.id)}
                onRenameCancel={() => setRenamingFolderId(null)}
                rowMenuKey={rowMenuKey}
                setRowMenuKey={setRowMenuKey}
                onPlayItem={playLibraryItem}
              />
            ))}
          </div>
        )}

        {grid ? (
          <div
            className={cn(
              'grid',
              compactLibrary ? 'gap-0.5' : 'gap-1',
              libraryExpanded
                ? compactLibrary
                  ? '[grid-template-columns:repeat(auto-fill,minmax(128px,1fr))] gap-3 p-2'
                  : '[grid-template-columns:repeat(auto-fill,minmax(150px,1fr))] gap-4 p-2'
                : 'grid-cols-2',
            )}
          >
            {showLiked && (
              <TrackDropZone accepts onDropTrack={dropTrackOnLiked}>
                <NavLink
                  to="/library?tab=liked"
                  onClick={() => libraryExpanded && setLibraryExpanded(false)}
                  className={({ isActive }) =>
                    cn(
                      'group/row block rounded-md transition-colors',
                      compactLibrary ? 'p-1.5' : 'p-2',
                      isActive ? 'bg-elevated' : 'hover:bg-elevated/50',
                    )
                  }
                >
                  <div className={cn(
                    'relative aspect-square w-full rounded-md bg-gradient-to-br from-purple-600 to-indigo-300 flex items-center justify-center overflow-hidden',
                    compactLibrary ? 'mb-1.5' : 'mb-2',
                  )}>
                    <HeartIcon className={cn('text-white', compactLibrary ? 'h-6 w-6' : 'h-8 w-8')} />
                    <LibraryPlayButton label={t('sidebar.likedSongs')} onPlay={playLikedSongs} />
                  </div>
                  <p className="truncate text-base font-bold leading-5 text-primary">{t('sidebar.likedSongs')}</p>
                  <p className="truncate text-sm font-semibold leading-5 text-[#b3b3b3]">
                    {t('sidebar.likedSongsSub', { n: likedSongs.length })}
                  </p>
                </NavLink>
              </TrackDropZone>
            )}
            {ungroupedItems.map((item) => {
              const playlist = item.kind === 'playlist' ? savedPlaylists.find((p) => p.id === item.id) : undefined
              return (
                <TrackDropZone
                  key={item.key}
                  accepts={item.acceptsTracks}
                  onDropTrack={(track) => dropTrackOnPlaylist(item.id, track)}
                >
                  {playlist ? (
                    <PlaylistLibraryRow
                      item={item}
                      playlist={playlist}
                      variant="grid"
                      compact={compactLibrary}
                      nowPlaying={isNowPlaying(item)}
                      pinned={pinned.has(item.key)}
                      showPin
                      onPlay={() => playLibraryItem(item)}
                      onNavigate={() => libraryExpanded && setLibraryExpanded(false)}
                    />
                  ) : (
                    <LibraryGridCard
                      item={item}
                      compact={compactLibrary}
                      nowPlaying={isNowPlaying(item)}
                      onNavigate={() => libraryExpanded && setLibraryExpanded(false)}
                      onPlay={() => playLibraryItem(item)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setRowMenuKey(rowMenuKey === item.key ? null : item.key)
                      }}
                    >
                      <RowOverlay
                        variant="grid"
                        itemKey={item.key}
                        pinned={pinned.has(item.key)}
                        showPin
                        folders={folders}
                        menuOpen={rowMenuKey === item.key}
                        onToggleMenu={() => setRowMenuKey(rowMenuKey === item.key ? null : item.key)}
                        onCloseMenu={() => setRowMenuKey(null)}
                      />
                    </LibraryGridCard>
                  )}
                </TrackDropZone>
              )
            })}
            {ungroupedItems.length === 0 && !showLiked && !hasFolderSection && (
              <p className="col-span-full text-sm text-secondary px-2 py-6 text-center">{t('sidebar.nothingHere')}</p>
            )}
          </div>
        ) : (
          <>
            {showLiked && (
              <TrackDropZone accepts onDropTrack={dropTrackOnLiked}>
                <NavLink
                  to="/library?tab=liked"
                  className={({ isActive }) =>
                    cn(
                      'group/row flex items-center rounded-md transition-colors',
                      compactLibrary ? 'gap-3 px-2 py-1.5' : 'gap-3 px-4 py-1.5',
                      isActive ? 'bg-elevated' : 'hover:bg-elevated/50',
                    )
                  }
                >
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-purple-600 to-indigo-300">
                    <HeartIcon className="h-5 w-5 text-white" />
                    <LibraryPlayButton label={t('sidebar.likedSongs')} onPlay={playLikedSongs} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold leading-5 text-primary">{t('sidebar.likedSongs')}</p>
                    <p className="truncate text-sm font-semibold leading-5 text-[#b3b3b3]">
                      {t('sidebar.likedSongsSub', { n: likedSongs.length })}
                    </p>
                  </div>
                </NavLink>
              </TrackDropZone>
            )}
            {ungroupedItems.map((item) => {
              const playlist = item.kind === 'playlist' ? savedPlaylists.find((p) => p.id === item.id) : undefined
              return (
                <TrackDropZone
                  key={item.key}
                  accepts={item.acceptsTracks}
                  onDropTrack={(track) => dropTrackOnPlaylist(item.id, track)}
                >
                  {playlist ? (
                    <PlaylistLibraryRow
                      item={item}
                      playlist={playlist}
                      variant="list"
                      compact={compactLibrary}
                      nowPlaying={isNowPlaying(item)}
                      pinned={pinned.has(item.key)}
                      showPin
                      onPlay={() => playLibraryItem(item)}
                    />
                  ) : (
                    <LibraryListRow
                      item={item}
                      compact={compactLibrary}
                      nowPlaying={isNowPlaying(item)}
                      onPlay={() => playLibraryItem(item)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setRowMenuKey(rowMenuKey === item.key ? null : item.key)
                      }}
                    >
                      <RowOverlay
                        variant="list"
                        itemKey={item.key}
                        pinned={pinned.has(item.key)}
                        showPin
                        folders={folders}
                        menuOpen={rowMenuKey === item.key}
                        onToggleMenu={() => setRowMenuKey(rowMenuKey === item.key ? null : item.key)}
                        onCloseMenu={() => setRowMenuKey(null)}
                      />
                    </LibraryListRow>
                  )}
                </TrackDropZone>
              )
            })}
            {ungroupedItems.length === 0 && !showLiked && !hasFolderSection && (
              <p className="text-sm text-secondary px-2 py-6 text-center">{t('sidebar.nothingHere')}</p>
            )}
          </>
        )}
      </div>

      <DragHandle onMouseDown={onDragStart} />
    </aside>
  )
}

/**
 * Wraps a library row as a drop target for dragged tracks. The hovered valid target
 * gets a bright green ring + tint and a subtle lift.
 */
function TrackDropZone({
  accepts,
  onDropTrack,
  className,
  children,
}: {
  accepts: boolean
  onDropTrack: (track: Track) => void
  className?: string
  children: React.ReactNode
}) {
  const { isOver, dropProps } = useTrackDrop(accepts, onDropTrack)
  return (
    <div
      data-track-drop-zone={accepts ? 'true' : undefined}
      {...(accepts ? dropProps : {})}
      style={
        isOver
          ? { boxShadow: `inset 0 0 0 2px ${DROP_GREEN}`, backgroundColor: `${DROP_GREEN}1a` }
          : undefined
      }
      className={cn(
        'rounded-md transition-[box-shadow,background-color,transform] duration-150',
        isOver && 'scale-[1.01]',
        className,
      )}
    >
      {children}
    </div>
  )
}

function PinButton({
  itemKey,
  pinned,
  variant,
}: {
  itemKey: string
  pinned: boolean
  variant: 'list' | 'grid'
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={(e) => {
        // Sibling of the NavLink, but guard against any bubbling to be safe.
        e.preventDefault()
        e.stopPropagation()
        togglePinned(itemKey)
      }}
      aria-label={pinned ? t('sidebar.unpinAria') : t('sidebar.pinAria')}
      aria-pressed={pinned}
      title={pinned ? t('sidebar.unpin') : t('sidebar.pin')}
      className={cn(
        'absolute z-10 rounded-full p-1.5 transition-all hover:scale-110 active:scale-90 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        // Sits just left of the row's ⋯ menu button.
        variant === 'list'
          ? 'right-9 top-1/2 -translate-y-1/2'
          : 'right-11 top-2 bg-page/70 backdrop-blur-sm',
        pinned
          ? 'text-accent opacity-100'
          : 'text-secondary opacity-0 hover:text-primary group-hover/row:opacity-100',
      )}
    >
      <PinIcon className="h-4 w-4" />
    </button>
  )
}

/** Pin (if shown) + the ⋯ "move to folder" menu, overlaid on a library row. */
function RowOverlay({
  variant,
  itemKey,
  pinned,
  showPin,
  folders,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: {
  variant: 'list' | 'grid'
  itemKey: string
  pinned: boolean
  showPin: boolean
  folders: LibraryFolder[]
  menuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
}) {
  return (
    <>
      {showPin && <PinButton itemKey={itemKey} pinned={pinned} variant={variant} />}
      <RowMenu
        variant={variant}
        itemKey={itemKey}
        folders={folders}
        open={menuOpen}
        onToggle={onToggleMenu}
        onClose={onCloseMenu}
      />
    </>
  )
}

/** Per-row dropdown to move an item into / out of a folder. */
function RowMenu({
  variant,
  itemKey,
  folders,
  open,
  onToggle,
  onClose,
}: {
  variant: 'list' | 'grid'
  itemKey: string
  folders: LibraryFolder[]
  open: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const currentFolderId = folderOfItem(folders, itemKey)
  const stop = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  return (
    <div
      className={cn(
        'absolute z-20',
        variant === 'list' ? 'right-1.5 top-1/2 -translate-y-1/2' : 'right-2 top-2',
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          stop(e)
          onToggle()
        }}
        aria-label={t('sidebar.moveToFolder')}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'rounded-full p-1.5 text-secondary transition-all hover:scale-110 hover:text-primary active:scale-90 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
          variant === 'grid' && 'bg-page/70 backdrop-blur-sm',
          open ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100',
        )}
      >
        <EllipsisHorizontalIcon className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { stop(e); onClose() }} />
          <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border border-secondary/10 bg-elevated py-1 shadow-xl">
            <p className="px-3 pb-1 pt-2 text-xs font-bold text-secondary">{t('sidebar.moveToFolder')}</p>
            <div className="max-h-56 overflow-y-auto">
              {folders.length === 0 && <p className="px-3 py-1.5 text-xs text-secondary">{t('sidebar.noFolders')}</p>}
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={(e) => {
                    stop(e)
                    addItemToFolder(f.id, itemKey)
                    onClose()
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-surface"
                >
                  <span className="truncate">{f.name}</span>
                  {currentFolderId === f.id && <CheckIcon className="h-4 w-4 shrink-0 text-accent" />}
                </button>
              ))}
            </div>
            <button
              onClick={(e) => {
                stop(e)
                const f = createFolder()
                addItemToFolder(f.id, itemKey)
                onClose()
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-surface"
            >
              <FolderPlusIcon className="h-4 w-4 shrink-0 text-secondary" /> {t('sidebar.newFolder')}
            </button>
            {currentFolderId && (
              <>
                <div className="my-1 border-t border-secondary/10" />
                <button
                  onClick={(e) => {
                    stop(e)
                    removeItemFromFolder(itemKey)
                    onClose()
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-surface"
                >
                  {t('sidebar.removeFromFolder')}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * A library row for a playlist whose ⋯ button and right-click both open the
 * full PlaylistMenu (queue, edit/delete, visibility, move-to-folder, pin,
 * share…) — the album-card-style menu, adjusted for playlists. Albums and
 * artists keep the lighter folder-only RowOverlay.
 */
function PlaylistLibraryRow({
  item,
  playlist,
  variant,
  compact,
  nowPlaying,
  pinned,
  showPin,
  onPlay,
  onNavigate,
}: {
  item: LibItem
  playlist: Playlist
  variant: 'list' | 'grid'
  compact: boolean
  nowPlaying: boolean
  pinned: boolean
  showPin: boolean
  onPlay: () => void | Promise<void>
  onNavigate?: () => void
}) {
  const menuRef = useRef<PlaylistMenuHandle>(null)
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    menuRef.current?.openAt(e.clientX, e.clientY)
  }
  const overlay = (
    <>
      {showPin && <PinButton itemKey={item.key} pinned={pinned} variant={variant} />}
      <div
        className={cn(
          'absolute z-20',
          variant === 'list' ? 'right-1.5 top-1/2 -translate-y-1/2' : 'right-2 top-2',
        )}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <PlaylistMenu
          playlist={playlist}
          ref={menuRef}
          hoverGroup="row"
          triggerClassName={cn(
            'rounded-full p-1.5 text-secondary transition-all hover:scale-110 hover:text-primary active:scale-90',
            variant === 'grid' && 'bg-page/70 backdrop-blur-sm',
          )}
          triggerIconClassName="h-4 w-4"
        />
      </div>
    </>
  )
  return variant === 'grid' ? (
    <LibraryGridCard
      item={item}
      compact={compact}
      nowPlaying={nowPlaying}
      onPlay={onPlay}
      onNavigate={onNavigate ?? (() => {})}
      onContextMenu={onContextMenu}
    >
      {overlay}
    </LibraryGridCard>
  ) : (
    <LibraryListRow item={item} compact={compact} nowPlaying={nowPlaying} onPlay={onPlay} onContextMenu={onContextMenu}>
      {overlay}
    </LibraryListRow>
  )
}

function LibraryPlayButton({
  label,
  onPlay,
}: {
  label: string
  onPlay: () => void | Promise<void>
}) {
  return (
    <button
      type="button"
      aria-label={`Play ${label}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void onPlay()
      }}
      className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/45 text-white opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
    >
      <PlayIcon className="h-5 w-5 translate-x-[1px]" />
    </button>
  )
}

/** A library row in list layout (used by the flat list + inside folders). */
function LibraryListRow({
  item,
  compact,
  nowPlaying,
  children,
  onPlay,
  onContextMenu,
}: {
  item: LibItem
  compact: boolean
  nowPlaying: boolean
  children?: React.ReactNode
  onPlay: () => void | Promise<void>
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  return (
    <div className="group/row relative" onContextMenu={onContextMenu}>
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          cn(
            'flex items-center rounded-md transition-colors',
            compact ? 'gap-3 px-2 py-1.5' : 'gap-3 px-4 py-1.5',
            isActive ? 'bg-elevated' : 'hover:bg-elevated/50',
          )
        }
      >
        <div
          className={cn(
            'relative h-12 w-12 shrink-0 overflow-hidden bg-elevated flex items-center justify-center',
            item.round ? 'rounded-full' : 'rounded-md',
          )}
        >
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <span className={compact ? 'text-base' : 'text-lg'}>{item.kind === 'artist' ? '🎤' : '🎵'}</span>
          )}
          <LibraryPlayButton label={item.name} onPlay={onPlay} />
        </div>
        <div className="min-w-0 flex-1 pr-14">
          <p className={cn('truncate text-base font-bold leading-5', nowPlaying ? 'text-accent' : 'text-primary')}>
            {item.name}
          </p>
          <p className="truncate text-sm font-semibold leading-5 text-[#b3b3b3]">{item.subtitle}</p>
        </div>
      </NavLink>
      {children}
    </div>
  )
}

/** A library item in grid layout. */
function LibraryGridCard({
  item,
  compact,
  nowPlaying,
  onNavigate,
  children,
  onPlay,
  onContextMenu,
}: {
  item: LibItem
  compact: boolean
  nowPlaying: boolean
  onNavigate: () => void
  children?: React.ReactNode
  onPlay: () => void | Promise<void>
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  return (
    <div className="group/row relative" onContextMenu={onContextMenu}>
      <NavLink
        to={item.to}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'block rounded-md transition-colors',
            compact ? 'p-1.5' : 'p-2',
            isActive ? 'bg-elevated' : 'hover:bg-elevated/50',
          )
        }
      >
        <div
          className={cn(
            'relative aspect-square w-full overflow-hidden bg-elevated flex items-center justify-center',
            compact ? 'mb-1.5' : 'mb-2',
            item.round ? 'rounded-full' : 'rounded-md',
          )}
        >
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <span className={compact ? 'text-xl' : 'text-2xl'}>{item.kind === 'artist' ? '🎤' : '🎵'}</span>
          )}
          <LibraryPlayButton label={item.name} onPlay={onPlay} />
        </div>
        <p className={cn('truncate text-base font-bold leading-5', nowPlaying ? 'text-accent' : 'text-primary')}>
          {item.name}
        </p>
        <p className="truncate text-sm font-semibold leading-5 text-[#b3b3b3]">{item.subtitle}</p>
      </NavLink>
      {children}
    </div>
  )
}

/** A collapsible folder header + its (indented) contents, list-style. */
function FolderGroup({
  folder,
  contents,
  compact,
  folders,
  playlists,
  isNowPlaying,
  renaming,
  renameValue,
  onRenameChange,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  rowMenuKey,
  setRowMenuKey,
  onPlayItem,
}: {
  folder: LibraryFolder
  contents: LibItem[]
  compact: boolean
  folders: LibraryFolder[]
  playlists: Playlist[]
  isNowPlaying: (item: LibItem) => boolean
  renaming: boolean
  renameValue: string
  onRenameChange: (v: string) => void
  onRenameStart: () => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  rowMenuKey: string | null
  setRowMenuKey: (key: string | null) => void
  onPlayItem: (item: LibItem) => void | Promise<void>
}) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const count = folder.itemKeys.length

  return (
    <div>
      <div className="group/folder relative">
        {renaming ? (
          <div className={cn('flex items-center rounded-md', compact ? 'gap-2 px-2 py-1' : 'gap-3 p-2')}>
            <span className="h-4 w-4 shrink-0" aria-hidden="true" />
            <div
              className={cn(
                'shrink-0 rounded-md bg-elevated flex items-center justify-center text-secondary',
                compact ? 'h-9 w-9' : 'h-12 w-12',
              )}
            >
              <FolderIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
            </div>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => onRenameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRenameCommit()
                else if (e.key === 'Escape') onRenameCancel()
              }}
              onBlur={onRenameCommit}
              aria-label={t('sidebar.folderName')}
              className="min-w-0 flex-1 rounded border border-accent/60 bg-surface px-1.5 py-1 text-sm font-medium text-primary outline-none"
            />
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setFolderCollapsed(folder.id, !folder.collapsed)}
              aria-expanded={!folder.collapsed}
              aria-label={t(folder.collapsed ? 'sidebar.expandFolder' : 'sidebar.collapseFolder', {
                name: folder.name,
              })}
              className={cn(
                'flex w-full items-center rounded-md text-left transition-colors hover:bg-elevated/50',
                compact ? 'gap-2 px-2 py-1' : 'gap-3 p-2',
              )}
            >
              {folder.collapsed ? (
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-secondary" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-secondary" />
              )}
              <div
                className={cn(
                  'shrink-0 rounded-md bg-elevated flex items-center justify-center text-secondary',
                  compact ? 'h-9 w-9' : 'h-12 w-12',
                )}
              >
                <FolderIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
              </div>
              <div className="min-w-0 flex-1 pr-7">
                <p className="truncate text-sm font-medium text-primary">{folder.name}</p>
                {!compact && (
                  <p className="truncate text-xs text-secondary">
                    {t(count === 1 ? 'sidebar.folderItem' : 'sidebar.folderItems', { n: count })}
                  </p>
                )}
              </div>
            </button>
            <div className="absolute right-1.5 top-1/2 z-20 -translate-y-1/2">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={t('sidebar.folderOptions')}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className={cn(
                  'rounded-full p-1.5 text-secondary transition-all hover:scale-110 hover:text-primary active:scale-90 focus-visible:opacity-100',
                  menuOpen ? 'opacity-100' : 'opacity-0 group-hover/folder:opacity-100',
                )}
              >
                <EllipsisHorizontalIcon className="h-4 w-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border border-secondary/10 bg-elevated py-1 shadow-xl">
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        onRenameStart()
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-surface"
                    >
                      <PencilIcon className="h-4 w-4 shrink-0 text-secondary" /> {t('sidebar.rename')}
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        deleteFolder(folder.id)
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-surface"
                    >
                      <TrashIcon className="h-4 w-4 shrink-0 text-secondary" /> {t('sidebar.deleteFolder')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {!folder.collapsed && (
        <div className="ml-4 border-l border-secondary/10 pl-1">
          {contents.length === 0 ? (
            <p className="px-3 py-2 text-xs text-secondary">{t('sidebar.folderEmpty')}</p>
          ) : (
            contents.map((item) => {
              const playlist = item.kind === 'playlist' ? playlists.find((p) => p.id === item.id) : undefined
              return playlist ? (
                <PlaylistLibraryRow
                  key={item.key}
                  item={item}
                  playlist={playlist}
                  variant="list"
                  compact={compact}
                  nowPlaying={isNowPlaying(item)}
                  pinned={false}
                  showPin={false}
                  onPlay={() => onPlayItem(item)}
                />
              ) : (
                <LibraryListRow
                  key={item.key}
                  item={item}
                  compact={compact}
                  nowPlaying={isNowPlaying(item)}
                  onPlay={() => onPlayItem(item)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setRowMenuKey(rowMenuKey === item.key ? null : item.key)
                  }}
                >
                  <RowOverlay
                    variant="list"
                    itemKey={item.key}
                    pinned={false}
                    showPin={false}
                    folders={folders}
                    menuOpen={rowMenuKey === item.key}
                    onToggleMenu={() => setRowMenuKey(rowMenuKey === item.key ? null : item.key)}
                    onCloseMenu={() => setRowMenuKey(null)}
                  />
                </LibraryListRow>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function DragHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="group absolute top-0 right-0 h-full w-2 cursor-grab active:cursor-grabbing z-20 flex justify-center"
      aria-hidden="true"
    >
      <div className="w-px h-full bg-transparent group-hover:bg-secondary/60 transition-colors" />
    </div>
  )
}

function DiagonalExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
      <path
        d="M16.6 5.6h2.2v2.2M18.8 5.6l-4.5 4.5M7.4 18.4H5.2v-2.2M5.2 18.4l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DiagonalCollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
      <path
        d="M18.6 5.4l-4.4 4.4M14.2 7.6v2.2h2.2M5.4 18.6l4.4-4.4M7.6 14.2h2.2v2.2"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
