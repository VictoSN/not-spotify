import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
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
import { HeartIcon } from '@heroicons/react/24/solid'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useUiStore } from '@/stores/uiStore'
import { useRatingStore } from '@/stores/ratingStore'
import { getPinnedSet, togglePinned, PINNED_EVENT } from '@/utils/pinnedLibrary'
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

const SORT_OPTIONS: { key: Sort; label: string }[] = [
  { key: 'recents', label: 'Recents' },
  { key: 'recentlyAdded', label: 'Recently Added' },
  { key: 'alpha', label: 'Alphabetical' },
  { key: 'creator', label: 'Creator' },
  { key: 'custom', label: 'Custom Order' },
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

export function Sidebar() {
  const navigate = useNavigate()
  const { savedPlaylists, savedAlbums, followedArtists, likedSongs, createPlaylist, fetchLibrary } = useLibraryStore()
  const loadRatings = useRatingStore((s) => s.loadFromBackend)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)

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
      openAuthPrompt({ title: 'Create playlists with a free account' })
      return
    }
    const playlist = await createPlaylist(`My Playlist #${savedPlaylists.length + 1}`)
    navigate(`/playlist/${playlist.id}`)
  }

  // ── Build the library list ──────────────────────────────────────
  const items = useMemo<LibItem[]>(() => {
    const playlists: LibItem[] = savedPlaylists.map((p) => ({
      key: `pl-${p.id}`,
      id: p.id,
      kind: 'playlist',
      name: p.name,
      subtitle: `Playlist • ${p.isOwner ? 'You' : (p.owner?.name ?? 'Unknown')}`,
      image: p.coverUrl,
      round: false,
      to: `/playlist/${p.id}`,
    }))
    const albums: LibItem[] = savedAlbums.map((a) => ({
      key: `al-${a.id}`,
      id: a.id,
      kind: 'album',
      name: a.title,
      subtitle: `Album • ${a.artist.name}`,
      image: a.coverUrl,
      round: false,
      to: `/album/${a.id}`,
    }))
    const artists: LibItem[] = followedArtists.map((a) => ({
      key: `ar-${a.id}`,
      id: a.id,
      kind: 'artist',
      name: a.name,
      subtitle: 'Artist',
      image: a.imageUrl,
      round: true,
      to: `/artist/${a.id}`,
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
  }, [savedPlaylists, savedAlbums, followedArtists, filter, query, sort, pinned])

  const showLiked =
    (filter === 'all' || filter === 'playlists') &&
    (!query.trim() || 'liked songs'.includes(query.trim().toLowerCase()))

  const isNowPlaying = (item: LibItem) =>
    !!currentTrack &&
    ((item.kind === 'album' && currentTrack.album.id === item.id) ||
      (item.kind === 'artist' && currentTrack.artist.id === item.id))

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
    flexBasis: collapsed ? RAIL : width,
    flexGrow: libraryExpanded ? 1 : 0,
    flexShrink: 0,
  }
  const frameClass = cn(
    'group/sidebar relative min-w-0 rounded-lg bg-sidebar flex flex-col overflow-hidden select-none',
    // Animate width (rail/drag) but expand instantly — a growing grid reflows columns and looks glitchy.
    !dragging && 'transition-[flex-basis] duration-300 ease-out',
  )

  // ── Rail (collapsed) ────────────────────────────────────────────
  if (!isAuthenticated && collapsed) {
    return (
      <aside style={frameStyle} className={frameClass}>
        <button
          onClick={() => setWidth(DEFAULT_W)}
          className="m-3 w-12 h-12 rounded-md flex items-center justify-center text-secondary hover:text-primary hover:bg-elevated hover:scale-105 transition-all"
          aria-label="Expand Your Library"
          title="Expand Your Library"
        >
          <ChevronDoubleRightIcon className="w-6 h-6" />
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
              aria-label="Collapse Your Library"
            >
              <ChevronDoubleLeftIcon className="w-5 h-5" />
              <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-left">Collapse Your Library</span>
            </button>
            <span className="truncate pl-0 text-sm font-bold leading-5 text-primary transition-all duration-200 group-hover/library-header:pl-7">
              Your Library
            </span>
          </div>
          <button
            onClick={handleCreate}
            className="spotify-tooltip-anchor relative flex shrink-0 items-center gap-1.5 rounded-full bg-elevated py-1.5 pl-2.5 pr-3.5 text-sm font-semibold text-primary transition-all hover:scale-105 hover:bg-elevated/70 active:scale-95"
            aria-label="Create playlist"
          >
            <PlusIcon className="w-4 h-4" />
            Create
            <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-right">
              Create a playlist, folder, or Jam
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="flex flex-col gap-3">
            <section className="rounded-lg bg-elevated p-4">
              <h2 className="text-sm font-bold text-primary">Create your first playlist</h2>
              <p className="mt-2 text-xs font-semibold text-primary">It's easy, we'll help you</p>
              <button
                onClick={() => openAuthPrompt({ title: 'Create playlists with a free account' })}
                className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-bold text-page transition-transform hover:scale-105 active:scale-95"
              >
                Create playlist
              </button>
            </section>

            <section className="rounded-lg bg-elevated p-4">
              <h2 className="text-sm font-bold text-primary">Let's find some podcasts to follow</h2>
              <p className="mt-2 text-xs font-semibold text-primary">We'll keep you updated on new episodes</p>
              <button
                onClick={() => openAuthPrompt({ title: 'Follow shows with a free account' })}
                className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-bold text-page transition-transform hover:scale-105 active:scale-95"
              >
                Browse podcasts
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
      <aside style={frameStyle} className={frameClass}>
        <button
          onClick={() => setWidth(DEFAULT_W)}
          className="m-3 w-12 h-12 rounded-md flex items-center justify-center text-secondary hover:text-primary hover:bg-elevated hover:scale-105 transition-all"
          aria-label="Expand Your Library"
          title="Expand Your Library"
        >
          <ChevronDoubleRightIcon className="w-6 h-6" />
        </button>

        <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col items-center gap-3 scrollbar-hide">
          <Link
            to="/library?tab=liked"
            title="Liked Songs"
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
    { key: 'playlists', label: 'Playlists' },
    { key: 'artists', label: 'Artists' },
    { key: 'albums', label: 'Albums' },
  ]

  return (
    <aside style={frameStyle} className={frameClass}>
      {/* Header */}
      <div className="group/library-header flex items-center justify-between px-4 pt-3 pb-3 gap-2">
        <div className="relative flex min-w-0 items-center">
          {!libraryExpanded && (
            <button
              onClick={() => setWidth(RAIL)}
              className="spotify-tooltip-anchor absolute left-0 z-10 -translate-x-1 text-secondary opacity-0 transition-all duration-200 hover:scale-110 hover:text-primary group-hover/library-header:translate-x-0 group-hover/library-header:opacity-100"
              aria-label="Collapse Your Library"
            >
              <ChevronDoubleLeftIcon className="w-5 h-5" />
              <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-left">Collapse Your Library</span>
            </button>
          )}
          <span
            className={cn(
              'truncate pl-0 text-sm font-bold leading-5 text-primary transition-all duration-200',
              !libraryExpanded && 'group-hover/library-header:pl-7',
            )}
          >
            Your Library
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <button
              onClick={() => setCreateMenuOpen((v) => !v)}
              className="spotify-tooltip-anchor relative flex items-center gap-1.5 rounded-full bg-elevated py-1.5 pl-2.5 pr-3.5 text-sm font-semibold text-primary transition-all hover:scale-105 hover:bg-elevated/70 active:scale-95"
              aria-label="Create playlist or folder"
              aria-haspopup="menu"
              aria-expanded={createMenuOpen}
            >
              <PlusIcon className="w-4 h-4" />
              Create
              {!createMenuOpen && (
                <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-right">
                  Create a playlist or folder
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
                    <MusicalNoteIcon className="h-4 w-4 shrink-0 text-secondary" /> Playlist
                  </button>
                  <button
                    onClick={() => {
                      setCreateMenuOpen(false)
                      handleCreateFolder()
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-surface"
                  >
                    <FolderPlusIcon className="h-4 w-4 shrink-0 text-secondary" /> Folder
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setLibraryExpanded(!libraryExpanded)}
            className="spotify-tooltip-anchor relative rounded-full p-1.5 text-secondary transition-all hover:scale-110 hover:bg-elevated hover:text-primary active:scale-90"
            aria-label={libraryExpanded ? 'Minimize Your Library' : 'Expand Your Library'}
          >
            {libraryExpanded ? <DiagonalCollapseIcon /> : <DiagonalExpandIcon />}
            <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-right">
              {libraryExpanded ? 'Minimize Your Library' : 'Expand Your Library'}
            </span>
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
        {filter !== 'all' && (
          <button
            onClick={() => setFilter('all')}
            className="w-7 h-7 rounded-full bg-elevated hover:bg-elevated/70 text-primary flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 transition-all"
            aria-label="Clear filter"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
        {chips
          .filter((c) => filter === 'all' || filter === c.key)
          .map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(filter === c.key ? 'all' : c.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95',
                filter === c.key
                  ? 'bg-primary text-page'
                  : 'bg-elevated text-secondary hover:text-primary hover:bg-elevated/70',
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
              placeholder="Search in Your Library"
              className="h-8 w-full rounded-full border border-transparent bg-elevated pl-8 pr-3 text-xs font-semibold text-primary transition-[background-color,border-color,box-shadow] duration-200 placeholder:font-semibold placeholder:text-muted focus:border-accent focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent/70"
            />
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="text-secondary hover:text-primary hover:scale-110 active:scale-90 p-1.5 rounded-full hover:bg-elevated transition-all"
            aria-label="Search in Your Library"
            title="Search in Your Library"
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
          </button>
        )}
        <div className="relative shrink-0">
          <button
            onClick={() => setSortMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-primary hover:scale-105 active:scale-95 transition-all px-1"
            title="Sort"
            aria-haspopup="menu"
            aria-expanded={sortMenuOpen}
          >
            {SORT_OPTIONS.find((o) => o.key === sort)?.label ?? 'Recents'}
            {viewMode === 'grid' ? <Squares2X2Icon className="w-4 h-4" /> : <ListBulletIcon className="w-4 h-4" />}
          </button>
          {sortMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSortMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 rounded-md border border-secondary/10 bg-elevated py-1 shadow-xl z-50">
                <p className="px-3 pb-1 pt-2 text-xs font-bold text-secondary">Sort by</p>
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => { setSort(o.key); setSortMenuOpen(false) }}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-surface"
                  >
                    <span className={cn(sort === o.key ? 'font-semibold text-accent' : 'text-primary')}>{o.label}</span>
                    {sort === o.key && <CheckIcon className="h-4 w-4 text-accent" />}
                  </button>
                ))}
                <div className="my-1 border-t border-secondary/10" />
                <p className="px-3 pb-1 pt-1 text-xs font-bold text-secondary">View as</p>
                <div className="flex items-center gap-1 px-2 pb-2">
                  <button
                    onClick={() => { setView('list'); setSortMenuOpen(false) }}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors',
                      viewMode === 'list' ? 'bg-surface text-primary' : 'text-secondary hover:text-primary',
                    )}
                  >
                    <ListBulletIcon className="h-4 w-4" /> List
                  </button>
                  <button
                    onClick={() => { setView('grid'); setSortMenuOpen(false) }}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors',
                      viewMode === 'grid' ? 'bg-surface text-primary' : 'text-secondary hover:text-primary',
                    )}
                  >
                    <Squares2X2Icon className="h-4 w-4" /> Grid
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Folders + library list/grid */}
      <div key={libraryExpanded ? 'expanded' : 'normal'} className="flex-1 overflow-y-auto px-2 pb-2 animate-fade-in">
        {hasFolderSection && (
          <div className="mb-1 flex flex-col">
            {folders.map((folder) => (
              <FolderGroup
                key={folder.id}
                folder={folder}
                contents={folder.itemKeys.map((k) => itemByKey.get(k)).filter((i): i is LibItem => !!i)}
                compact={compactLibrary}
                folders={folders}
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
              <NavLink
                to="/library?tab=liked"
                onClick={() => libraryExpanded && setLibraryExpanded(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-md transition-colors',
                    compactLibrary ? 'p-1.5' : 'p-2',
                    isActive ? 'bg-elevated' : 'hover:bg-elevated/50',
                  )
                }
              >
                <div className={cn(
                  'aspect-square w-full rounded-md bg-gradient-to-br from-purple-600 to-indigo-300 flex items-center justify-center',
                  compactLibrary ? 'mb-1.5' : 'mb-2',
                )}>
                  <HeartIcon className={cn('text-white', compactLibrary ? 'h-6 w-6' : 'h-8 w-8')} />
                </div>
                <p className="text-sm font-medium text-primary truncate">Liked Songs</p>
                {!compactLibrary && <p className="text-xs text-secondary truncate">Playlist • {likedSongs.length} songs</p>}
              </NavLink>
            )}
            {ungroupedItems.map((item) => (
              <LibraryGridCard
                key={item.key}
                item={item}
                compact={compactLibrary}
                nowPlaying={isNowPlaying(item)}
                onNavigate={() => libraryExpanded && setLibraryExpanded(false)}
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
            ))}
            {ungroupedItems.length === 0 && !showLiked && !hasFolderSection && (
              <p className="col-span-full text-sm text-secondary px-2 py-6 text-center">Nothing here yet.</p>
            )}
          </div>
        ) : (
          <>
            {showLiked && (
              <NavLink
                to="/library?tab=liked"
                className={({ isActive }) =>
                  cn(
                    'flex items-center rounded-md transition-colors',
                    compactLibrary ? 'gap-2 px-2 py-1' : 'gap-3 p-2',
                    isActive ? 'bg-elevated' : 'hover:bg-elevated/50',
                  )
                }
              >
                <div className={cn(
                  'rounded-md bg-gradient-to-br from-purple-600 to-indigo-300 flex items-center justify-center shrink-0',
                  compactLibrary ? 'h-9 w-9' : 'h-12 w-12',
                )}>
                  <HeartIcon className={cn('text-white', compactLibrary ? 'h-4 w-4' : 'h-5 w-5')} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary truncate">Liked Songs</p>
                  {!compactLibrary && <p className="text-xs text-secondary truncate">Playlist • {likedSongs.length} songs</p>}
                </div>
              </NavLink>
            )}
            {ungroupedItems.map((item) => (
              <LibraryListRow key={item.key} item={item} compact={compactLibrary} nowPlaying={isNowPlaying(item)}>
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
            ))}
            {ungroupedItems.length === 0 && !showLiked && !hasFolderSection && (
              <p className="text-sm text-secondary px-2 py-6 text-center">Nothing here yet.</p>
            )}
          </>
        )}
      </div>

      <DragHandle onMouseDown={onDragStart} />
    </aside>
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
  return (
    <button
      type="button"
      onClick={(e) => {
        // Sibling of the NavLink, but guard against any bubbling to be safe.
        e.preventDefault()
        e.stopPropagation()
        togglePinned(itemKey)
      }}
      aria-label={pinned ? 'Unpin from Your Library' : 'Pin to top of Your Library'}
      aria-pressed={pinned}
      title={pinned ? 'Unpin' : 'Pin'}
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
        aria-label="Move to folder"
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
            <p className="px-3 pb-1 pt-2 text-xs font-bold text-secondary">Move to folder</p>
            <div className="max-h-56 overflow-y-auto">
              {folders.length === 0 && <p className="px-3 py-1.5 text-xs text-secondary">No folders yet</p>}
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
              <FolderPlusIcon className="h-4 w-4 shrink-0 text-secondary" /> New folder
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
                  Remove from folder
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** A library row in list layout (used by the flat list + inside folders). */
function LibraryListRow({
  item,
  compact,
  nowPlaying,
  children,
}: {
  item: LibItem
  compact: boolean
  nowPlaying: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="group/row relative">
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          cn(
            'flex items-center rounded-md transition-colors',
            compact ? 'gap-2 px-2 py-1' : 'gap-3 p-2',
            isActive ? 'bg-elevated' : 'hover:bg-elevated/50',
          )
        }
      >
        <div
          className={cn(
            'shrink-0 overflow-hidden bg-elevated flex items-center justify-center',
            compact ? 'h-9 w-9' : 'h-12 w-12',
            item.round ? 'rounded-full' : 'rounded-md',
          )}
        >
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <span className={compact ? 'text-base' : 'text-lg'}>{item.kind === 'artist' ? '🎤' : '🎵'}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 pr-14">
          <p className={cn('text-sm font-medium truncate', nowPlaying ? 'text-accent' : 'text-primary')}>{item.name}</p>
          {!compact && <p className="text-xs text-secondary truncate">{item.subtitle}</p>}
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
}: {
  item: LibItem
  compact: boolean
  nowPlaying: boolean
  onNavigate: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="group/row relative">
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
            'aspect-square w-full overflow-hidden bg-elevated flex items-center justify-center',
            compact ? 'mb-1.5' : 'mb-2',
            item.round ? 'rounded-full' : 'rounded-md',
          )}
        >
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <span className={compact ? 'text-xl' : 'text-2xl'}>{item.kind === 'artist' ? '🎤' : '🎵'}</span>
          )}
        </div>
        <p className={cn('text-sm font-medium truncate', nowPlaying ? 'text-accent' : 'text-primary')}>{item.name}</p>
        {!compact && <p className="text-xs text-secondary truncate">{item.subtitle}</p>}
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
  isNowPlaying,
  renaming,
  renameValue,
  onRenameChange,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  rowMenuKey,
  setRowMenuKey,
}: {
  folder: LibraryFolder
  contents: LibItem[]
  compact: boolean
  folders: LibraryFolder[]
  isNowPlaying: (item: LibItem) => boolean
  renaming: boolean
  renameValue: string
  onRenameChange: (v: string) => void
  onRenameStart: () => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  rowMenuKey: string | null
  setRowMenuKey: (key: string | null) => void
}) {
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
              aria-label="Folder name"
              className="min-w-0 flex-1 rounded border border-accent/60 bg-surface px-1.5 py-1 text-sm font-medium text-primary outline-none"
            />
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setFolderCollapsed(folder.id, !folder.collapsed)}
              aria-expanded={!folder.collapsed}
              aria-label={folder.collapsed ? `Expand ${folder.name}` : `Collapse ${folder.name}`}
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
                    Folder • {count} item{count === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            </button>
            <div className="absolute right-1.5 top-1/2 z-20 -translate-y-1/2">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Folder options"
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
                      <PencilIcon className="h-4 w-4 shrink-0 text-secondary" /> Rename
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        deleteFolder(folder.id)
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-surface"
                    >
                      <TrashIcon className="h-4 w-4 shrink-0 text-secondary" /> Delete folder
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
            <p className="px-3 py-2 text-xs text-secondary">Empty — add items from a row's ⋯ menu.</p>
          ) : (
            contents.map((item) => (
              <LibraryListRow key={item.key} item={item} compact={compact} nowPlaying={isNowPlaying(item)}>
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
            ))
          )}
        </div>
      )}
    </div>
  )
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 3.5h6M10.5 3.5v5.2L8 11.7v1.1h8v-1.1L13.5 8.7V3.5M12 12.8V20.5" />
    </svg>
  )
}

function DragHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="group absolute top-0 right-0 h-full w-2 cursor-col-resize z-20 flex justify-center"
      aria-hidden="true"
    >
      <div className="w-px h-full bg-transparent group-hover:bg-accent/50 transition-colors" />
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
