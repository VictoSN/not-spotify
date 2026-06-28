import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { CollapseIcon } from '@/components/common/CollapseIcon'
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
import { HeartIcon, PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore, type PlayContextType } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useUiStore } from '@/stores/uiStore'
import { useRatingStore } from '@/stores/ratingStore'
import { useTranslation } from '@/i18n/useTranslation'
import { recordPlay, getPlayHistory, PLAY_HISTORY_EVENT } from '@/utils/playHistory'
import type { Track } from '@/types/track'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { MusicVideo } from '@/types/musicVideo'
import type { PodcastSummary } from '@/types/podcast'
import type { Playlist } from '@/types/playlist'
import { PlaylistRowMenu, type PlaylistRowMenuHandle } from '@/components/cards/PlaylistRowMenu'
import { AlbumMenu, type AlbumMenuHandle } from '@/components/cards/AlbumMenu'
import { ArtistMenu, type ArtistMenuHandle } from '@/components/cards/ArtistMenu'
import { VideoMenu, type VideoMenuHandle } from '@/components/cards/VideoMenu'
import { PodcastMenu, type PodcastMenuHandle } from '@/components/cards/PodcastMenu'
import {
  CONTEXT_MENU_ITEM_CLASS,
  CONTEXT_MENU_PANEL_CLASS,
  isSidebarBlankContextTarget,
  openMenuAtPointer,
} from '@/utils/contextMenu'
import { artistService } from '@/services/artistService'
import { trackService } from '@/services/trackService'
import { playlistService } from '@/services/playlistService'
import { useDragStore } from '@/stores/dragStore'
import { useTrackDrop } from '@/hooks/useTrackDrop'
import { useLibraryDrop } from '@/hooks/useLibraryDrop'
import { usePlayContextGate } from '@/hooks/usePlaybackGate'
import { usePlaybackContext, type PlaybackContextInput } from '@/hooks/usePlaybackContext'
import { DROP_GREEN } from '@/utils/trackDnd'
import { notify } from '@/utils/toast'
import {
  type LibraryFolder,
  getFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  setFolderCollapsed,
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
type ViewMode = 'list' | 'list-compact' | 'grid' | 'grid-compact'

const SORT_OPTIONS: { key: Sort; tKey: string }[] = [
  { key: 'recents', tKey: 'sort.recents' },
  { key: 'recentlyAdded', tKey: 'sort.recentlyAdded' },
  { key: 'alpha', tKey: 'sort.alpha' },
  { key: 'creator', tKey: 'sort.creator' },
  { key: 'custom', tKey: 'sort.custom' },
]

type LibKind = 'playlist' | 'album' | 'artist' | 'video' | 'podcast'

interface LibItem {
  key: string
  id: string
  kind: LibKind
  name: string
  subtitle: string
  image: string | null
  playlist?: Playlist
  round: boolean
  to: string
  /** True for playlists the user owns — the only library rows a track can be dropped onto. */
  acceptsTracks: boolean
  /** Whether this row exposes an inline play button (videos/podcasts are navigate-only). */
  playable: boolean
  /** ISO date string for "Date added" column in expanded list view. */
  addedAt?: string
  /** ISO date string for "Played" column — recorded locally on play. */
  playedAt?: string
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

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'list'
  const v = window.localStorage.getItem('ns-library-view')
  if (v === 'list' || v === 'list-compact' || v === 'grid' || v === 'grid-compact') return v
  // Migrate legacy compact flag
  try {
    const compact = JSON.parse(window.localStorage.getItem(COMPACT_LIBRARY_KEY) ?? 'false') === true
    return compact ? 'list-compact' : 'list'
  } catch {
    return 'list'
  }
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'Today'
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
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
    savedVideos,
    savedPodcasts,
    followedArtists,
    followedArtistIds,
    likedSongs,
    createPlaylist,
    fetchLibrary,
    followArtist,
    saveAlbum,
    saveVideo,
    savePodcast,
  } = useLibraryStore()
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist)
  const likeTrack = useLibraryStore((s) => s.likeTrack)
  const likedTrackIds = useLibraryStore((s) => s.likedTrackIds)
  const loadRatings = useRatingStore((s) => s.loadFromBackend)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const currentContextType = usePlayerStore((s) => s.currentContextType)
  const currentContextId = usePlayerStore((s) => s.currentContextId)
  const setKaraokeOpen = usePlayerStore((s) => s.setKaraokeOpen)
  const startContext = usePlayContextGate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const { t } = useTranslation()

  const [width, setWidth] = useState(getInitialWidth)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recents')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode)
  const [playHistory, setPlayHistory] = useState(getPlayHistory)
  const [folders, setFolders] = useState<LibraryFolder[]>(getFolders)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [blankCreateMenu, setBlankCreateMenu] = useState<{ x: number; y: number } | null>(null)
  const [libraryBodyScrolled, setLibraryBodyScrolled] = useState(false)
  const libraryExpanded = useUiStore((s) => s.libraryExpanded)
  const setLibraryExpanded = useUiStore((s) => s.setLibraryExpanded)
  const libraryDragActive = useDragStore(
    (s) => !!s.draggedTrack || !!s.draggedArtist || !!s.draggedAlbum || !!s.draggedVideo || !!s.draggedPodcast,
  )
  const handlePrimaryNavigationClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('a[href]')) setKaraokeOpen(false)
  }

  // True for the duration of an expand/minimize. Hover-only chrome (the collapse
  // icon, the title nudge) is suppressed while this is set so it can't flicker in
  // mid-resize, and the content crossfades so its list↔grid reflow is masked.
  const [isLibraryAnimating, setIsLibraryAnimating] = useState(false)
  const libAnimTimer = useRef<number | null>(null)
  const toggleLibraryExpanded = () => {
    if (libAnimTimer.current) window.clearTimeout(libAnimTimer.current)
    setIsLibraryAnimating(true)
    setLibraryBodyScrolled(false)
    // Slightly longer than the 300ms width transition so the reveal lands after it settles.
    libAnimTimer.current = window.setTimeout(() => {
      setIsLibraryAnimating(false)
    }, 320)
    setLibraryExpanded(!libraryExpanded)
  }
  const collapseLibrarySidebar = () => {
    if (libraryExpanded) setLibraryExpanded(false)
    setWidth(RAIL)
  }
  useEffect(() => () => {
    if (libAnimTimer.current) window.clearTimeout(libAnimTimer.current)
  }, [])

  const setView = (v: ViewMode) => {
    setViewMode(v)
    try {
      window.localStorage.setItem('ns-library-view', v)
    } catch {
      /* ignore */
    }
  }

  const collapsed = width <= RAIL
  const isGrid = viewMode === 'grid' || viewMode === 'grid-compact'
  const listCompact = viewMode === 'list-compact'
  const gridCompact = viewMode === 'grid-compact'
  const compactLibrary = listCompact || gridCompact
  const grid = isGrid
  const compactLibraryHeader = !libraryExpanded && width < 340
  const compactCreateButton = compactLibraryHeader
  const handleLibraryBodyScroll = (event: UIEvent<HTMLDivElement>) => {
    const next = event.currentTarget.scrollTop > 8
    setLibraryBodyScrolled((current) => (current === next ? current : next))
  }

  useEffect(() => {
    setLibraryBodyScrolled(false)
  }, [collapsed, libraryExpanded, filter, query, viewMode])

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

  useEffect(() => {
    const sync = () => setPlayHistory(getPlayHistory())
    window.addEventListener(PLAY_HISTORY_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PLAY_HISTORY_EVENT, sync)
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

  const dropVideoOnLibrary = (video: MusicVideo) => {
    if (savedVideos.some((item) => item.id === video.id)) {
      notify.info('Already in Your Library')
      return
    }
    saveVideo(video)
    notify.success('Saved video to Your Library')
  }

  const dropPodcastOnLibrary = (podcast: PodcastSummary) => {
    if (savedPodcasts.some((item) => item.id === podcast.id)) {
      notify.info('Already in Your Library')
      return
    }
    savePodcast(podcast)
    notify.success('Saved podcast to Your Library')
  }

  // The whole library surface is a drop target, so tracks, artists, albums, and
  // singles can be saved regardless of filters or scroll position.
  const libraryDrop = useLibraryDrop(isAuthenticated, {
    onDropTrack: dropTrackOnLiked,
    onDropArtist: dropArtistOnLibrary,
    onDropAlbum: dropAlbumOnLibrary,
    onDropVideo: dropVideoOnLibrary,
    onDropPodcast: dropPodcastOnLibrary,
  })

  // ── Build the library list ──────────────────────────────────────
  const items = useMemo<LibItem[]>(() => {
    const history = playHistory
    const playlists: LibItem[] = savedPlaylists.map((p) => ({
      key: `pl-${p.id}`,
      id: p.id,
      kind: 'playlist',
      name: p.name,
      subtitle: t('sidebar.subtitle.playlist', {
        owner: p.isOwner ? t('sidebar.you') : (p.owner?.name ?? t('sidebar.unknown')),
      }),
      image: p.coverUrl,
      playlist: p,
      round: false,
      to: `/playlist/${p.id}`,
      acceptsTracks: !!p.isOwner,
      playable: true,
      addedAt: p.createdAt,
      playedAt: history[`playlist:${p.id}`],
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
      playable: true,
      playedAt: history[`album:${a.id}`],
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
      playable: true,
      playedAt: history[`artist:${a.id}`],
    }))
    // Videos + podcasts are saved client-side and surface in the default ("all")
    // view only. They're navigate-only — opening the row goes to the page where
    // playback lives, so they carry no inline play button or play context.
    const videos: LibItem[] = savedVideos.map((v) => ({
      key: `vid-${v.id}`,
      id: v.id,
      kind: 'video',
      name: v.title,
      subtitle: `Music video • ${v.artist.name}`,
      image: v.thumbnailUrl,
      round: false,
      to: `/videos/${v.id}`,
      acceptsTracks: false,
      playable: false,
    }))
    const podcasts: LibItem[] = savedPodcasts.map((p) => ({
      key: `pod-${p.id}`,
      id: p.id,
      kind: 'podcast',
      name: p.title,
      subtitle: `Podcast • ${p.author}`,
      image: p.imageUrl,
      round: false,
      to: `/podcasts/${p.id}`,
      acceptsTracks: false,
      playable: false,
    }))

    let list =
      filter === 'playlists'
        ? playlists
        : filter === 'albums'
          ? albums
          : filter === 'artists'
            ? artists
            : [...playlists, ...albums, ...artists, ...podcasts, ...videos]

    const q = query.trim().toLowerCase()
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q))
    if (sort === 'alpha') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'creator') list = [...list].sort((a, b) => a.subtitle.localeCompare(b.subtitle))
    return list
  }, [savedPlaylists, savedAlbums, followedArtists, savedVideos, savedPodcasts, filter, query, sort, playHistory, t])

  const likedSongsQuery = t('sidebar.likedSongs').toLowerCase()
  const showLiked =
    (filter === 'all' || filter === 'playlists') &&
    (!query.trim() ||
      'liked songs'.includes(query.trim().toLowerCase()) ||
      likedSongsQuery.includes(query.trim().toLowerCase()))

  const isNowPlaying = (item: LibItem) =>
    (item.kind === 'album' && currentContextType !== 'artist' && currentContextType !== 'mix' && currentTrack?.album.id === item.id) ||
    (item.kind === 'artist' && currentContextType === 'artist' && currentContextId === item.id) ||
    (item.kind === 'playlist' && currentContextType === 'playlist' && currentContextId === item.id)

  const playLikedSongs = () => {
    if (likedSongs.length === 0) {
      notify.info('No liked songs yet')
      return
    }
    startContext({ type: 'liked', id: 'liked' }, likedSongs)
  }

  const playLibraryItem = async (item: LibItem) => {
    try {
      if (item.kind === 'playlist') {
        const cached = savedPlaylists.find((p) => p.id === item.id)
        let tracks = (cached?.tracks ?? []).map((row) => row.track)
        // Library rows come from the summary endpoint, which omits the track
        // list (only a count) — fetch the full playlist so it can actually play.
        if (tracks.length === 0) {
          const full = await playlistService.getById(item.id)
          tracks = (full.tracks ?? []).map((row) => row.track)
        }
        if (tracks.length > 0) { if (startContext({ type: 'playlist', id: item.id }, tracks)) recordPlay('playlist', item.id) }
        else notify.info('No tracks in this playlist yet')
        return
      }

      if (item.kind === 'album') {
        const tracks = await trackService.getByAlbum(item.id)
        if (tracks.length > 0) { if (startContext({ type: 'album', id: item.id }, tracks)) recordPlay('album', item.id) }
        else notify.info('No tracks available for this release yet')
        return
      }

      const tracks = await artistService.getTopTracks(item.id, 20)
      if (tracks.length > 0) { if (startContext({ type: 'artist', id: item.id }, tracks)) recordPlay('artist', item.id) }
      else notify.info('No tracks available for this artist yet')
    } catch {
      notify.error("Couldn't start playback")
    }
  }

  // The full Playlist for a playlist library row (drives its right-click menu);
  // undefined for albums/artists, which keep the ⋯ menu only.
  const playlistById = useMemo(() => new Map(savedPlaylists.map((p) => [p.id, p])), [savedPlaylists])
  const playlistFor = (item: LibItem): Playlist | undefined =>
    item.kind === 'playlist' ? playlistById.get(item.id) : undefined
  const albumById = useMemo(() => new Map(savedAlbums.map((a) => [a.id, a])), [savedAlbums])
  const albumFor = (item: LibItem): Album | undefined =>
    item.kind === 'album' ? albumById.get(item.id) : undefined
  const artistById = useMemo(() => new Map(followedArtists.map((a) => [a.id, a])), [followedArtists])
  const artistFor = (item: LibItem): Artist | undefined =>
    item.kind === 'artist' ? artistById.get(item.id) : undefined
  const videoById = useMemo(() => new Map(savedVideos.map((video) => [video.id, video])), [savedVideos])
  const videoFor = (item: LibItem): MusicVideo | undefined =>
    item.kind === 'video' ? videoById.get(item.id) : undefined
  const podcastById = useMemo(() => new Map(savedPodcasts.map((podcast) => [podcast.id, podcast])), [savedPodcasts])
  const podcastFor = (item: LibItem): PodcastSummary | undefined =>
    item.kind === 'podcast' ? podcastById.get(item.id) : undefined

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

  const openLibraryCreateContextMenu = (event: React.MouseEvent) => {
    event.preventDefault()
    setCreateMenuOpen(false)
    setSortMenuOpen(false)
    setBlankCreateMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 192)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 104)),
    })
  }

  const handleLibraryBlankContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isSidebarBlankContextTarget(event.target, event.defaultPrevented)) return
    openLibraryCreateContextMenu(event)
  }

  const handleLibraryTitleContextMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || window.getSelection()?.toString().trim()) return
    event.stopPropagation()
    openLibraryCreateContextMenu(event)
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
    'group/sidebar sidebar-scrollbar-hover-region library-sidebar-motion relative z-30 flex h-full max-h-full min-h-0 min-w-0 flex-col overflow-visible rounded-xl bg-sidebar select-none',
    // Animate width (rail/drag) AND the expand/minimize grow — flex-grow interpolates as a
    // number, so the panel smoothly fills the home area and slides back. Skipped while dragging.
    dragging && 'library-sidebar-dragging',
    takeoverHidden ? 'pointer-events-none -translate-x-4 opacity-0' : 'translate-x-0 opacity-100',
  )

  // ── Rail (collapsed) ────────────────────────────────────────────
  if (!isAuthenticated && collapsed) {
    return (
      <aside style={frameStyle} className={frameClass}>
        <button
          onClick={() => setWidth(DEFAULT_W)}
          className="m-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-secondary transition-all hover:scale-105 hover:bg-elevated hover:text-primary"
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
        <div
          className={cn(
            'group/library-header sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 rounded-t-xl bg-sidebar px-4 pb-3 pt-3 transition-[background-color,box-shadow] duration-200',
            libraryBodyScrolled ? 'shadow-[0_8px_20px_rgba(0,0,0,0.22)]' : 'shadow-none',
          )}
        >
          <div className="relative flex min-w-0 items-center">
            <button
              onClick={collapseLibrarySidebar}
              className="spotify-tooltip-anchor invisible absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-secondary opacity-0 transition-all duration-200 hover:scale-110 hover:bg-elevated hover:text-primary group-hover/sidebar:visible group-hover/sidebar:opacity-100"
              aria-label={t('sidebar.collapse')}
            >
              <CollapseIcon className="h-6 w-6 -scale-x-100" />
              <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-left">{t('sidebar.collapse')}</span>
            </button>
            <button
              type="button"
              onClick={collapseLibrarySidebar}
              className={cn(
                'min-w-0 truncate rounded-sm pl-0 text-left font-bold leading-5 text-primary transition-all duration-200 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 group-hover/sidebar:pl-9',
                'text-base',
              )}
              aria-label={t('sidebar.collapse')}
              title={t('sidebar.collapse')}
            >
              {t('sidebar.title')}
            </button>
          </div>
          <button
            onClick={handleCreate}
            className={cn(
              'spotify-tooltip-anchor relative flex h-8 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-normal text-primary transition-all hover:scale-105 hover:bg-elevated/70 active:scale-95',
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

        <div onScroll={handleLibraryBodyScroll} className="spotify-scrollbar sidebar-hover-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <div className="flex flex-col gap-3">
            <section className="rounded-lg bg-elevated p-4">
              <h2 className="text-sm font-normal text-primary">{t('sidebar.auth.createTitle')}</h2>
              <p className="mt-2 text-xs font-normal text-primary">{t('sidebar.auth.createSub')}</p>
              <button
                onClick={() => openAuthPrompt({ title: t('sidebar.auth.createPromptTitle') })}
                className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-normal text-page transition-transform hover:scale-105 active:scale-95"
              >
                {t('sidebar.auth.createButton')}
              </button>
            </section>

            <section className="rounded-lg bg-elevated p-4">
              <h2 className="text-sm font-normal text-primary">{t('sidebar.auth.podcastsTitle')}</h2>
              <p className="mt-2 text-xs font-normal text-primary">{t('sidebar.auth.podcastsSub')}</p>
              <button
                onClick={() => openAuthPrompt({ title: t('sidebar.auth.podcastsPromptTitle') })}
                className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-normal text-page transition-transform hover:scale-105 active:scale-95"
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
        style={frameStyle}
        className={frameClass}
        onClickCapture={handlePrimaryNavigationClick}
      >
        <button
          onClick={() => setWidth(DEFAULT_W)}
          className="m-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-secondary transition-all hover:scale-105 hover:bg-elevated hover:text-primary"
          aria-label={t('sidebar.expand')}
          title={t('sidebar.expand')}
        >
          <CollapseIcon className="h-6 w-6" />
        </button>

        <div
          className={cn(
            'animate-fade-in flex-1 overflow-y-auto px-3 pb-3 flex flex-col items-center gap-3 scrollbar-hide',
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
            <CollapsedLibraryItem
              key={item.key}
              item={item}
              compact={compactLibrary}
              video={videoFor(item)}
              podcast={podcastFor(item)}
            />
          ))}
        </div>

        {libraryDrop.isOver && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-30 rounded-xl border-2 shadow-[0_0_0_1px_rgba(30,215,96,0.22)]"
            style={{ borderColor: DROP_GREEN }}
          />
        )}
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
      style={frameStyle}
      className={frameClass}
      onClickCapture={handlePrimaryNavigationClick}
    >
      <div
        onContextMenu={handleLibraryBlankContextMenu}
        data-sidebar-empty-space="true"
        data-sidebar-header-space="true"
        className={cn(
          'sticky top-0 z-20 shrink-0 rounded-t-xl bg-sidebar transition-[background-color,box-shadow,backdrop-filter] duration-200',
          libraryBodyScrolled ? 'shadow-[0_8px_20px_rgba(0,0,0,0.22)] backdrop-blur-md' : 'shadow-none backdrop-blur-0',
        )}
      >
        {/* Header — no own background: it would paint square over the wrapper's
            rounded-t-xl top corners. The rounded `bg-sidebar` wrapper supplies the
            background, so the top corners stay rounded. */}
        <div className="group/library-header flex items-center justify-between gap-2 px-4 pb-3 pt-3">
          <div className="relative flex min-w-0 items-center">
            {!libraryExpanded && (
              <button
                onClick={collapseLibrarySidebar}
                className={cn(
                  'spotify-tooltip-anchor invisible absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-secondary opacity-0 transition-all duration-200 hover:scale-110 hover:bg-elevated hover:text-primary',
                  // Reveal on hover only once the resize has settled, so it never flashes in mid-minimize.
                  !isLibraryAnimating && 'group-hover/sidebar:visible group-hover/sidebar:opacity-100',
                )}
                aria-label={t('sidebar.collapse')}
              >
                <CollapseIcon className="h-6 w-6 -scale-x-100" />
                <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-left">{t('sidebar.collapse')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={collapseLibrarySidebar}
              onContextMenu={handleLibraryTitleContextMenu}
              className={cn(
                'min-w-0 truncate rounded-sm pl-0 text-left font-bold leading-5 text-primary transition-all duration-200 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
                'text-base',
                !libraryExpanded && !isLibraryAnimating && 'group-hover/sidebar:pl-9',
              )}
              aria-label={t('sidebar.collapse')}
              title={t('sidebar.collapse')}
            >
              {t('sidebar.title')}
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setCreateMenuOpen((v) => !v)}
                className={cn(
                  'spotify-tooltip-anchor relative flex h-8 items-center justify-center rounded-full bg-elevated text-xs font-normal text-primary transition-all hover:scale-105 hover:bg-elevated/70 active:scale-95',
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
                  <div className="fixed inset-0 z-[990]" onClick={() => setCreateMenuOpen(false)} />
                  <div role="menu" className="absolute right-0 top-full z-[1000] mt-2 w-44 rounded-md border border-secondary/10 bg-elevated py-1 shadow-xl">
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
              onClick={toggleLibraryExpanded}
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
        <div className="flex flex-wrap items-center gap-2 bg-sidebar px-4 pb-3">
        {filter !== 'all' && (
          <button
            onClick={() => setFilter('all')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-primary transition-all hover:scale-105 hover:bg-elevated/70 active:scale-95"
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
                'flex h-8 items-center rounded-full px-3 text-xs font-normal transition-all active:scale-95',
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
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 bg-sidebar px-4 pb-2">
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
              className="h-8 w-full rounded-full border border-transparent bg-elevated pl-8 pr-3 text-xs font-normal text-primary transition-[background-color,border-color,box-shadow] duration-200 placeholder:font-normal placeholder:text-muted focus:border-accent focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent/70"
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
            className="flex items-center gap-1.5 text-xs font-normal text-secondary hover:text-primary hover:scale-105 active:scale-95 transition-all px-1"
            title={t('sidebar.sort')}
            aria-haspopup="menu"
            aria-expanded={sortMenuOpen}
          >
            {t(SORT_OPTIONS.find((o) => o.key === sort)?.tKey ?? 'sort.recents')}
            {isGrid ? <Squares2X2Icon className="w-4 h-4" /> : <ListBulletIcon className="w-4 h-4" />}
          </button>
          {sortMenuOpen && (
            <>
              <div className="fixed inset-0 z-[990]" onClick={() => setSortMenuOpen(false)} />
              <div role="menu" className="absolute right-0 top-full z-[1000] mt-2 w-56 rounded-md border border-secondary/10 bg-elevated py-1 shadow-xl">
                <p className="px-3 pb-1 pt-2 text-xs font-normal text-secondary">{t('sidebar.sortBy')}</p>
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => { setSort(o.key); setSortMenuOpen(false) }}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-surface"
                  >
                    <span className={cn(sort === o.key ? 'font-normal text-accent' : 'text-primary')}>{t(o.tKey)}</span>
                    {sort === o.key && <CheckIcon className="h-4 w-4 text-accent" />}
                  </button>
                ))}
                <div className="my-1 border-t border-secondary/10" />
                <p className="px-3 pb-1 pt-1 text-xs font-normal text-secondary">{t('sidebar.viewAs')}</p>
                <div className="flex items-center gap-0.5 mx-2 mb-2 p-1 rounded-md bg-surface">
                  {(
                    [
                      {
                        v: 'list-compact' as ViewMode,
                        label: t('sidebar.view.listCompact'),
                        icon: (
                          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                            <path d="M15.5 13.5H.5V12h15zm0-4.75H.5v-1.5h15zm0-4.75H.5V2.5h15z" />
                          </svg>
                        ),
                      },
                      {
                        v: 'list' as ViewMode,
                        label: t('sidebar.view.list'),
                        icon: (
                          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                            <path d="M15 14.5H5V13h10zm0-5.75H5v-1.5h10zM15 3H5V1.5h10zM3 3H1V1.5h2zm0 11.5H1V13h2zm0-5.75H1v-1.5h2z" />
                          </svg>
                        ),
                      },
                      {
                        v: 'grid-compact' as ViewMode,
                        label: t('sidebar.view.gridCompact'),
                        icon: (
                          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                            <path d="M1 1h3v3H1zm0 5.5h3v3H1zM4 12H1v3h3zM6.5 1h3v3h-3zm3 5.5h-3v3h3zm-3 5.5h3v3h-3zM15 1h-3v3h3zm-3 5.5h3v3h-3zm3 5.5h-3v3h3z" />
                          </svg>
                        ),
                      },
                      {
                        v: 'grid' as ViewMode,
                        label: t('sidebar.view.grid'),
                        icon: (
                          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                            <path d="M1 1h6v6H1zm1.5 1.5v3h3v-3zM1 9h6v6H1zm1.5 1.5v3h3v-3zM9 1h6v6H9zm1.5 1.5v3h3v-3zM9 9h6v6H9zm1.5 1.5v3h3v-3z" />
                          </svg>
                        ),
                      },
                    ]
                  ).map(({ v, icon, label }) => (
                    <button
                      key={v}
                      onClick={() => { setView(v); setSortMenuOpen(false) }}
                      aria-label={label}
                      className={cn(
                        'spotify-tooltip-anchor relative flex flex-1 items-center justify-center rounded-md py-2 transition-colors',
                        viewMode === v ? 'bg-elevated text-primary' : 'text-secondary hover:text-primary',
                      )}
                    >
                      {icon}
                      <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-center">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      </div>

      {/* Folders + library list/grid */}
      <div
        key={libraryExpanded ? 'expanded' : 'normal'}
        onScroll={handleLibraryBodyScroll}
        onContextMenu={handleLibraryBlankContextMenu}
        data-sidebar-empty-space="true"
        className={cn(
          // Mounts fresh at opacity-0 each toggle so the list↔grid reflow happens unseen while
          // the panel resizes, then fades in once the width settles (isLibraryAnimating clears).
          'spotify-scrollbar sidebar-hover-scrollbar ns-bleed-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2 transition-opacity duration-300 ease-out motion-reduce:transition-none',
          isLibraryAnimating ? 'opacity-0' : 'opacity-100',
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
                compact={listCompact}
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
                onPlayItem={playLibraryItem}
                playlistFor={playlistFor}
                albumFor={albumFor}
                artistFor={artistFor}
                videoFor={videoFor}
                podcastFor={podcastFor}
              />
            ))}
          </div>
        )}

        {grid ? (
          <div
            className={cn(
              'grid',
              gridCompact ? 'gap-0.5' : 'gap-1',
              libraryExpanded
                ? gridCompact
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
                      gridCompact ? 'p-1.5' : 'p-2',
                      isActive ? 'bg-elevated' : 'hover:bg-elevated/50',
                    )
                  }
                >
                  <div className={cn(
                    'relative aspect-square w-full rounded-md bg-gradient-to-br from-purple-600 to-indigo-300 flex items-center justify-center overflow-hidden',
                    !gridCompact && 'mb-2',
                  )}>
                    <HeartIcon className={cn('text-white', gridCompact ? 'h-6 w-6' : 'h-8 w-8')} />
                    <LibraryPlayButton label={t('sidebar.likedSongs')} context={{ type: 'liked', id: 'liked' }} onStart={playLikedSongs} />
                  </div>
                  {!gridCompact && (
                    <>
                      <p className="truncate text-sm font-normal leading-tight text-primary">{t('sidebar.likedSongs')}</p>
                      <p className="mt-0.5 truncate text-[13px] font-normal leading-tight text-secondary">
                        {t('sidebar.likedSongsSub', { n: likedSongs.length })}
                      </p>
                    </>
                  )}
                </NavLink>
              </TrackDropZone>
            )}
            {ungroupedItems.map((item) => (
              <TrackDropZone
                key={item.key}
                accepts={item.acceptsTracks}
                onDropTrack={(track) => dropTrackOnPlaylist(item.id, track)}
              >
                <LibraryGridCard
                  item={item}
                  compact={gridCompact}
                  nowPlaying={isNowPlaying(item)}
                  onNavigate={() => libraryExpanded && setLibraryExpanded(false)}
                  onPlay={() => playLibraryItem(item)}
                  menuPlaylist={playlistFor(item)}
                  menuAlbum={albumFor(item)}
                  menuArtist={artistFor(item)}
                  menuVideo={videoFor(item)}
                  menuPodcast={podcastFor(item)}
                />

              </TrackDropZone>
            ))}
            {ungroupedItems.length === 0 && !showLiked && !hasFolderSection && (
              <p className="col-span-full text-sm text-secondary px-2 py-6 text-center">{t('sidebar.nothingHere')}</p>
            )}
          </div>
        ) : (
          <>
            {libraryExpanded && (
              <div className="mb-1 flex items-center gap-3 border-b border-secondary/10 px-4 pb-1">
                {!listCompact && <div className="w-12 shrink-0" />}
                <div className="flex flex-1 items-center">
                  <span className="flex-1 text-xs font-normal text-secondary">{t('sidebar.col.title')}</span>
                  <span className="w-1/4 shrink-0 text-center text-xs font-normal text-secondary">{t('sidebar.col.dateAdded')}</span>
                  <span className="w-1/5 shrink-0 pr-4 text-right text-xs font-normal text-secondary">{t('sidebar.col.played')}</span>
                </div>
              </div>
            )}
            {showLiked && (
              <TrackDropZone accepts onDropTrack={dropTrackOnLiked}>
                <NavLink
                  to="/library?tab=liked"
                  className={({ isActive }) =>
                    cn(
                      'group/row flex items-center rounded-md transition-colors',
                      listCompact ? 'gap-3 px-2 py-1.5' : 'gap-3 px-4 py-1.5',
                      isActive ? 'bg-elevated' : 'hover:bg-elevated/50',
                    )
                  }
                >
                  {!listCompact && (
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-purple-600 to-indigo-300">
                      <HeartIcon className="h-5 w-5 text-white" />
                      <LibraryPlayButton label={t('sidebar.likedSongs')} context={{ type: 'liked', id: 'liked' }} onStart={playLikedSongs} />
                    </div>
                  )}
                  <div className={cn('min-w-0 flex-1', libraryExpanded && 'flex items-center')}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-normal leading-tight text-primary">{t('sidebar.likedSongs')}</p>
                      <p className="mt-0.5 truncate text-[13px] font-normal leading-tight text-secondary">
                        {t('sidebar.likedSongsSub', { n: likedSongs.length })}
                      </p>
                    </div>
                    {libraryExpanded && (
                      <>
                        <span className="w-1/4 shrink-0 text-center text-[13px] text-secondary">—</span>
                        <span className="w-1/5 shrink-0 pr-4 text-right text-[13px] text-secondary">—</span>
                      </>
                    )}
                  </div>
                </NavLink>
              </TrackDropZone>
            )}
            {ungroupedItems.map((item) => (
              <TrackDropZone
                key={item.key}
                accepts={item.acceptsTracks}
                onDropTrack={(track) => dropTrackOnPlaylist(item.id, track)}
              >
                <LibraryListRow
                  item={item}
                  compact={listCompact}
                  expanded={libraryExpanded}
                  nowPlaying={isNowPlaying(item)}
                  onPlay={() => playLibraryItem(item)}
                  onNavigate={() => { if (libraryExpanded) setLibraryExpanded(false) }}
                  menuPlaylist={playlistFor(item)}
                  menuAlbum={albumFor(item)}
                  menuArtist={artistFor(item)}
                  menuVideo={videoFor(item)}
                  menuPodcast={podcastFor(item)}
                />
              </TrackDropZone>
            ))}
            {ungroupedItems.length === 0 && !showLiked && !hasFolderSection && (
              <p className="text-sm text-secondary px-2 py-6 text-center">{t('sidebar.nothingHere')}</p>
            )}
          </>
        )}
      </div>

      {blankCreateMenu && createPortal(
        <>
          <div
            className="fixed inset-0 z-[990]"
            aria-hidden="true"
            onClick={() => setBlankCreateMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault()
              setBlankCreateMenu(null)
            }}
          />
          <div
            role="menu"
            aria-label={t('sidebar.createAria')}
            className={`fixed ${CONTEXT_MENU_PANEL_CLASS}`}
            style={{ left: blankCreateMenu.x, top: blankCreateMenu.y }}
          >
            <button
              role="menuitem"
              onClick={() => {
                setBlankCreateMenu(null)
                void handleCreate()
              }}
              className={CONTEXT_MENU_ITEM_CLASS}
            >
              <MusicalNoteIcon className="h-4 w-4 shrink-0 text-secondary" /> {t('sidebar.createPlaylist')}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setBlankCreateMenu(null)
                handleCreateFolder()
              }}
              className={CONTEXT_MENU_ITEM_CLASS}
            >
              <FolderPlusIcon className="h-4 w-4 shrink-0 text-secondary" /> {t('sidebar.createFolder')}
            </button>
          </div>
        </>,
        document.body,
      )}

      {libraryDrop.isOver && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30 rounded-xl border-2 shadow-[0_0_0_1px_rgba(30,215,96,0.22)]"
          style={{ borderColor: DROP_GREEN }}
        />
      )}
      <DragHandle onMouseDown={onDragStart} />
    </aside>
  )
}

/**
 * Wraps a library row as a drop target for dragged tracks. The hovered valid target
 * gets a bright Spotify-green ring without tinting the row content.
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
          ? { boxShadow: `0 0 0 2px ${DROP_GREEN}, 0 0 0 4px ${DROP_GREEN}24` }
          : undefined
      }
      className={cn(
        'rounded-md transition-[box-shadow,transform] duration-150',
        isOver && 'scale-[1.01]',
        className,
      )}
    >
      {children}
    </div>
  )
}


function LibraryArtwork({
  item,
  compact,
  grid = false,
}: {
  item: LibItem
  compact: boolean
  grid?: boolean
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const imageSrc = item.image && failedSrc !== item.image ? item.image : undefined
  const fallbackSize = grid
    ? compact ? 'text-xl' : 'text-2xl'
    : compact ? 'text-base' : 'text-lg'

  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt={item.name}
        draggable={false}
        className="h-full w-full object-cover"
        onError={() => setFailedSrc(imageSrc)}
      />
    )
  }

  if (item.kind === 'playlist' && item.playlist) {
    // Keep the sidebar fallback static so artwork transforms cannot compete with
    // the sidebar's own expand/minimize transition.
    return <MusicalNoteIcon className={cn('text-secondary', grid ? 'h-8 w-8' : 'h-5 w-5')} />
  }

  if (item.kind === 'artist') {
    return (
      <span className={cn('select-none font-normal uppercase text-secondary', fallbackSize)}>
        {libraryInitials(item.name)}
      </span>
    )
  }

  return <MusicalNoteIcon className={cn('text-secondary', grid ? 'h-8 w-8' : 'h-5 w-5')} />
}

function libraryInitials(name: string | undefined | null) {
  if (!name) return '?'
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  return (words[0] ?? '?').slice(0, 2).toUpperCase()
}

/** A minimized-sidebar item with the same media context menus as expanded rows. */
function CollapsedLibraryItem({
  item,
  compact,
  video,
  podcast,
}: {
  item: LibItem
  compact: boolean
  video?: MusicVideo
  podcast?: PodcastSummary
}) {
  const videoMenuRef = useRef<VideoMenuHandle>(null)
  const podcastMenuRef = useRef<PodcastMenuHandle>(null)
  const handleContextMenu = video
    ? (event: React.MouseEvent) => openMenuAtPointer(event, videoMenuRef)
    : podcast
      ? (event: React.MouseEvent) => openMenuAtPointer(event, podcastMenuRef)
      : undefined

  return (
    <div className="group/row relative" onContextMenu={handleContextMenu}>
      <Link
        to={item.to}
        title={item.name}
        aria-label={item.name}
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden bg-elevated transition-transform hover:scale-105',
          item.round ? 'rounded-full' : 'rounded-md',
        )}
      >
        <LibraryArtwork item={item} compact={compact} />
      </Link>
      {video && (
        <VideoMenu ref={videoMenuRef} video={video}
          triggerClassName="absolute bottom-0 right-0 z-20 rounded-full bg-black/70 p-1 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
          triggerIconClassName="h-3.5 w-3.5 text-white" />
      )}
      {podcast && (
        <PodcastMenu ref={podcastMenuRef} podcast={podcast}
          triggerClassName="absolute bottom-0 right-0 z-20 rounded-full bg-black/70 p-1 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
          triggerIconClassName="h-3.5 w-3.5 text-white" />
      )}
    </div>
  )
}

/**
 * Cover overlay play/pause button. Derives its icon purely from the global
 * player (no local state): pause when this surface is the active *playing*
 * context, play otherwise. Clicking toggles play/pause when active, or starts
 * the surface via `onStart` when it isn't. Stays visible while active.
 */
function LibraryPlayButton({
  label,
  context,
  onStart,
}: {
  label: string
  context: PlaybackContextInput
  onStart: () => void | Promise<void>
}) {
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  const { isActiveContext, isPlayingContext } = usePlaybackContext(context)
  return (
    <button
      type="button"
      aria-label={isPlayingContext ? `Pause ${label}` : `Play ${label}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (isActiveContext) togglePlayPause()
        else void onStart()
      }}
      className={cn(
        'absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/45 text-white transition-opacity duration-150 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
        isActiveContext ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100',
      )}
    >
      {isPlayingContext ? (
        <PauseIcon className="h-5 w-5" />
      ) : (
        <PlayIcon className="h-5 w-5 translate-x-[1px]" />
      )}
    </button>
  )
}

/** A library row in list layout (used by the flat list + inside folders). */
function LibraryListRow({
  item,
  compact,
  expanded = false,
  nowPlaying,
  children,
  onPlay,
  onNavigate,
  menuPlaylist,
  menuAlbum,
  menuArtist,
  menuVideo,
  menuPodcast,
}: {
  item: LibItem
  compact: boolean
  expanded?: boolean
  nowPlaying: boolean
  children?: React.ReactNode
  onPlay: () => void | Promise<void>
  onNavigate?: () => void
  menuPlaylist?: Playlist
  menuAlbum?: Album
  menuArtist?: Artist
  menuVideo?: MusicVideo
  menuPodcast?: PodcastSummary
}) {
  // Playlists get the Spotify-style pointer menu; other rows keep the ⋯ behaviour.
  const playlistMenuRef = useRef<PlaylistRowMenuHandle>(null)
  const albumMenuRef = useRef<AlbumMenuHandle>(null)
  const artistMenuRef = useRef<ArtistMenuHandle>(null)
  const videoMenuRef = useRef<VideoMenuHandle>(null)
  const podcastMenuRef = useRef<PodcastMenuHandle>(null)
  const handleContextMenu = menuPlaylist
    ? (e: React.MouseEvent) => openMenuAtPointer(e, playlistMenuRef)
    : menuAlbum
      ? (e: React.MouseEvent) => openMenuAtPointer(e, albumMenuRef)
      : menuArtist
        ? (e: React.MouseEvent) => openMenuAtPointer(e, artistMenuRef)
        : menuVideo
          ? (e: React.MouseEvent) => openMenuAtPointer(e, videoMenuRef)
          : menuPodcast
            ? (e: React.MouseEvent) => openMenuAtPointer(e, podcastMenuRef)
            : undefined
  return (
    <div
      className="group/row relative"
      onContextMenu={handleContextMenu}
    >
      <NavLink
        to={item.to}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'flex items-center rounded-md transition-colors',
            compact ? 'gap-2 px-3 py-2' : 'gap-3 px-4 py-1.5',
            isActive ? 'bg-elevated' : 'hover:bg-elevated/50',
          )
        }
      >
        {!compact && (
          <div
            className={cn(
              'relative h-12 w-12 shrink-0 overflow-hidden bg-elevated flex items-center justify-center',
              item.round ? 'rounded-full' : 'rounded-md',
            )}
          >
            <LibraryArtwork item={item} compact={false} />
            {item.playable && (
              <LibraryPlayButton label={item.name} context={{ type: item.kind as PlayContextType, id: item.id }} onStart={onPlay} />
            )}
          </div>
        )}
        <div className={cn('min-w-0 flex-1', expanded ? 'flex items-center' : 'pr-14')}>
          <div className="min-w-0 flex-1">
            <p className={cn('truncate text-sm font-normal leading-tight', nowPlaying ? 'text-accent' : 'text-primary')}>
              {item.name}
            </p>
            <p className="mt-0.5 truncate text-[13px] font-normal leading-tight text-secondary">
              {item.subtitle}
            </p>
          </div>
          {expanded && (
            <>
              <span className="w-1/4 shrink-0 text-center text-[13px] text-secondary">
                {item.addedAt ? relativeDate(item.addedAt) : '—'}
              </span>
              <span className="w-1/5 shrink-0 pr-4 text-right text-[13px] text-secondary">
                {item.playedAt ? relativeDate(item.playedAt) : '—'}
              </span>
            </>
          )}
        </div>
      </NavLink>
      {children}
      {menuPlaylist && <PlaylistRowMenu ref={playlistMenuRef} playlist={menuPlaylist} />}
      {menuAlbum && (
        <div className="hidden">
          <AlbumMenu ref={albumMenuRef} album={menuAlbum} />
        </div>
      )}
      {menuArtist && (
        <div className="hidden">
          <ArtistMenu ref={artistMenuRef} artist={menuArtist} />
        </div>
      )}
      {menuVideo && (
        <VideoMenu ref={videoMenuRef} video={menuVideo}
          triggerClassName="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full p-1.5"
          triggerIconClassName="h-5 w-5 stroke-[2.2] text-secondary hover:text-primary" />
      )}
      {menuPodcast && (
        <PodcastMenu ref={podcastMenuRef} podcast={menuPodcast}
          triggerClassName="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full p-1.5"
          triggerIconClassName="h-5 w-5 stroke-[2.2] text-secondary hover:text-primary" />
      )}
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
  menuPlaylist,
  menuAlbum,
  menuArtist,
  menuVideo,
  menuPodcast,
}: {
  item: LibItem
  compact: boolean
  nowPlaying: boolean
  onNavigate: () => void
  children?: React.ReactNode
  onPlay: () => void | Promise<void>
  menuPlaylist?: Playlist
  menuAlbum?: Album
  menuArtist?: Artist
  menuVideo?: MusicVideo
  menuPodcast?: PodcastSummary
}) {
  const playlistMenuRef = useRef<PlaylistRowMenuHandle>(null)
  const albumMenuRef = useRef<AlbumMenuHandle>(null)
  const artistMenuRef = useRef<ArtistMenuHandle>(null)
  const videoMenuRef = useRef<VideoMenuHandle>(null)
  const podcastMenuRef = useRef<PodcastMenuHandle>(null)
  const handleContextMenu = menuPlaylist
    ? (e: React.MouseEvent) => openMenuAtPointer(e, playlistMenuRef)
    : menuAlbum
      ? (e: React.MouseEvent) => openMenuAtPointer(e, albumMenuRef)
      : menuArtist
        ? (e: React.MouseEvent) => openMenuAtPointer(e, artistMenuRef)
        : menuVideo
          ? (e: React.MouseEvent) => openMenuAtPointer(e, videoMenuRef)
          : menuPodcast
            ? (e: React.MouseEvent) => openMenuAtPointer(e, podcastMenuRef)
            : undefined
  return (
    <div className="group/row relative" onContextMenu={handleContextMenu}>
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
            !compact && 'mb-2',
            item.round ? 'rounded-full' : 'rounded-md',
          )}
        >
          <LibraryArtwork item={item} compact={compact} grid />
          {item.playable && (
            <LibraryPlayButton label={item.name} context={{ type: item.kind as PlayContextType, id: item.id }} onStart={onPlay} />
          )}
        </div>
        {!compact && (
          <>
            <p className={cn('truncate text-sm font-normal leading-tight', nowPlaying ? 'text-accent' : 'text-primary')}>
              {item.name}
            </p>
            <p className="mt-0.5 truncate text-[13px] font-normal leading-tight text-secondary">{item.subtitle}</p>
          </>
        )}
      </NavLink>
      {children}
      {menuPlaylist && <PlaylistRowMenu ref={playlistMenuRef} playlist={menuPlaylist} />}
      {menuAlbum && (
        <div className="hidden">
          <AlbumMenu ref={albumMenuRef} album={menuAlbum} />
        </div>
      )}
      {menuArtist && (
        <div className="hidden">
          <ArtistMenu ref={artistMenuRef} artist={menuArtist} />
        </div>
      )}
      {menuVideo && (
        <VideoMenu ref={videoMenuRef} video={menuVideo}
          triggerClassName="absolute right-2 top-2 z-20 rounded-full bg-black/65 p-1.5 backdrop-blur-sm" />
      )}
      {menuPodcast && (
        <PodcastMenu ref={podcastMenuRef} podcast={menuPodcast}
          triggerClassName="absolute right-2 top-2 z-20 rounded-full bg-black/65 p-1.5 backdrop-blur-sm" />
      )}
    </div>
  )
}

/** A collapsible folder header + its (indented) contents, list-style. */
function FolderGroup({
  folder,
  contents,
  compact,
  isNowPlaying,
  renaming,
  renameValue,
  onRenameChange,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onPlayItem,
  playlistFor,
  albumFor,
  artistFor,
  videoFor,
  podcastFor,
}: {
  folder: LibraryFolder
  contents: LibItem[]
  compact: boolean
  isNowPlaying: (item: LibItem) => boolean
  renaming: boolean
  renameValue: string
  onRenameChange: (v: string) => void
  onRenameStart: () => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onPlayItem: (item: LibItem) => void | Promise<void>
  playlistFor: (item: LibItem) => Playlist | undefined
  albumFor: (item: LibItem) => Album | undefined
  artistFor: (item: LibItem) => Artist | undefined
  videoFor: (item: LibItem) => MusicVideo | undefined
  podcastFor: (item: LibItem) => PodcastSummary | undefined
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
              className="min-w-0 flex-1 rounded border border-accent/60 bg-surface px-1.5 py-1 text-sm font-normal text-primary outline-none"
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
                <p className="truncate text-sm font-normal text-primary">{folder.name}</p>
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
                  <div className="fixed inset-0 z-[990]" onClick={() => setMenuOpen(false)} />
                  <div role="menu" className="absolute right-0 top-full z-[1000] mt-1 w-44 rounded-md border border-secondary/10 bg-elevated py-1 shadow-xl">
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
            contents.map((item) => (
              <LibraryListRow
                key={item.key}
                item={item}
                compact={compact}
                nowPlaying={isNowPlaying(item)}
                onPlay={() => onPlayItem(item)}
                menuPlaylist={playlistFor(item)}
                menuAlbum={albumFor(item)}
                menuArtist={artistFor(item)}
                menuVideo={videoFor(item)}
                menuPodcast={podcastFor(item)}
              />
            ))
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
      className="group absolute -right-2 top-0 z-20 flex h-full w-2 cursor-grab justify-center active:cursor-grabbing"
      aria-hidden="true"
    >
      <div className="h-full w-px bg-transparent transition-colors group-hover:bg-secondary/70" />
    </div>
  )
}

function DiagonalExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
      <path
        d="M16.6 5.6h2.2v2.2M18.8 5.6l-4.5 4.5M7.4 18.4H5.2v-2.2M5.2 18.4l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.7"
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
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
