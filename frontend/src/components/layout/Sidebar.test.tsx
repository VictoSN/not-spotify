import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from './Sidebar'
import { useAuthStore } from '@/stores/authStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useRatingStore } from '@/stores/ratingStore'
import { useUiStore } from '@/stores/uiStore'
import type { MusicVideo } from '@/types/musicVideo'
import type { PodcastSummary } from '@/types/podcast'

class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const originalAuthState = useAuthStore.getState()
const originalLibraryState = useLibraryStore.getState()
const originalPlayerState = usePlayerStore.getState()
const originalRatingState = useRatingStore.getState()
const originalUiState = useUiStore.getState()
const createPlaylistMock = vi.fn(async () => ({ id: 'created-playlist' }))

const video: MusicVideo = {
  id: 'video-14', title: 'Phase Fourteen Video', description: null,
  artist: { id: 'artist-14', name: 'Sidebar Artist', imageUrl: null },
  trackId: null, videoUrl: '/phase-14.mp4', thumbnailUrl: '/phase-14.jpg',
  durationMs: 120_000, viewCount: 14, createdAt: '2026-06-27T00:00:00Z',
}

const podcast: PodcastSummary = {
  id: 'podcast-14', title: 'Phase Fourteen Podcast', author: 'Sidebar Host',
  description: null, category: 'Technology', imageUrl: '/phase-14-podcast.jpg',
  episodeCount: 14, createdAt: '2026-06-27T00:00:00Z',
}

function LocationProbe() {
  return <output aria-label="current route">{useLocation().pathname}</output>
}

function renderSidebar() {
  return render(<MemoryRouter initialEntries={['/library']}><Sidebar /><LocationProbe /></MemoryRouter>)
}

describe('Sidebar saved media navigation', () => {
  beforeEach(() => {
    window.localStorage.clear()
    createPlaylistMock.mockClear()
    useAuthStore.setState({ isAuthenticated: true })
    usePlayerStore.setState({ isKaraokeOpen: false })
    useUiStore.setState({ libraryExpanded: false })
    useRatingStore.setState({ loadFromBackend: vi.fn(async () => {}) })
    useLibraryStore.setState({
      savedPlaylists: [], likedSongs: [], followedArtists: [], savedAlbums: [],
      savedVideos: [video], savedPodcasts: [podcast], likedTrackIds: new Set(),
      followedArtistIds: new Set(), savedAlbumIds: new Set(),
      savedVideoIds: new Set([video.id]), savedPodcastIds: new Set([podcast.id]),
      isLoading: false,
      fetchLibrary: vi.fn(async () => {}),
      createPlaylist: createPlaylistMock as never,
    })
  })

  afterEach(() => {
    act(() => {
      useAuthStore.setState(originalAuthState, true)
      useLibraryStore.setState(originalLibraryState, true)
      usePlayerStore.setState(originalPlayerState, true)
      useRatingStore.setState(originalRatingState, true)
      useUiStore.setState(originalUiState, true)
    })
    window.localStorage.clear()
  })

  const expectRoute = (route: string) =>
    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent(route)

  it('navigates saved MV and podcast rows in the expanded list layout', () => {
    usePlayerStore.setState({ isKaraokeOpen: true })
    renderSidebar()
    fireEvent.click(screen.getByRole('link', { name: new RegExp(video.title) }))
    expectRoute(`/videos/${video.id}`)
    expect(usePlayerStore.getState().isKaraokeOpen).toBe(false)

    usePlayerStore.setState({ isKaraokeOpen: true })
    fireEvent.click(screen.getByRole('link', { name: new RegExp(podcast.title) }))
    expectRoute(`/podcasts/${podcast.id}`)
    expect(usePlayerStore.getState().isKaraokeOpen).toBe(false)
  })

  it('keeps saved MV and podcast navigation working in the minimized rail', () => {
    window.localStorage.setItem('ns-sidebar-width', '72')
    renderSidebar()
    fireEvent.click(screen.getByRole('link', { name: video.title }))
    expectRoute(`/videos/${video.id}`)
    fireEvent.click(screen.getByRole('link', { name: podcast.title }))
    expectRoute(`/podcasts/${podcast.id}`)
  })

  it('keeps saved MV and podcast navigation working in grid layout', () => {
    window.localStorage.setItem('ns-library-view', 'grid')
    renderSidebar()
    fireEvent.click(screen.getByRole('link', { name: new RegExp(video.title) }))
    expectRoute(`/videos/${video.id}`)
    fireEvent.click(screen.getByRole('link', { name: new RegExp(podcast.title) }))
    expectRoute(`/podcasts/${podcast.id}`)
  })

  it('shows the balanced library skeleton while saved media is loading', () => {
    useLibraryStore.setState({ isLoading: true })
    renderSidebar()

    expect(screen.getByRole('status', { name: 'Loading your library' })).toBeInTheDocument()
    expect(screen.queryByText(video.title)).not.toBeInTheDocument()
  })

  it('uses three columns throughout the final ten percent of the sidebar drag range', () => {
    window.localStorage.setItem('ns-library-view', 'grid')
    window.localStorage.setItem('ns-sidebar-width', '406')
    const { container, unmount } = renderSidebar()

    expect(container.querySelector('.grid.grid-cols-3')).toBeInTheDocument()

    unmount()
    window.localStorage.setItem('ns-sidebar-width', '405')
    const standard = renderSidebar()
    expect(standard.container.querySelector('.grid.grid-cols-2')).toBeInTheDocument()
  })

  it('keeps the Recents icon aligned and synchronized with the selected view', () => {
    renderSidebar()

    const viewMenu = screen.getByRole('button', { name: 'Recents' })
    expect(viewMenu).toHaveClass('h-8', 'items-center', 'gap-2', 'leading-none')
    expect(viewMenu.querySelector('[data-library-view-icon="list"]')).toBeInTheDocument()

    const selections = [
      ['Compact list', 'list-compact'],
      ['Compact grid', 'grid-compact'],
      ['Grid', 'grid'],
      ['List', 'list'],
    ] as const

    for (const [label, mode] of selections) {
      fireEvent.click(viewMenu)
      fireEvent.click(screen.getByRole('button', { name: label }))

      expect(viewMenu.querySelector(`[data-library-view-icon="${mode}"]`)).toBeInTheDocument()
      expect(window.localStorage.getItem('ns-library-view')).toBe(mode)
    }
  })

  it('keeps saved MV and podcast navigation working inside a library folder', () => {
    window.localStorage.setItem('ns-library-folders', JSON.stringify([{
      id: 'media-folder', name: 'Saved media',
      itemKeys: [`vid-${video.id}`, `pod-${podcast.id}`], collapsed: false,
    }]))
    renderSidebar()
    fireEvent.click(screen.getByRole('link', { name: new RegExp(video.title) }))
    expectRoute(`/videos/${video.id}`)
    fireEvent.click(screen.getByRole('link', { name: new RegExp(podcast.title) }))
    expectRoute(`/podcasts/${podcast.id}`)
  })

  it('opens media menus by trigger and right-click without navigating the row', async () => {
    renderSidebar()
    fireEvent.click(screen.getByRole('button', { name: `More options for ${video.title}` }))
    expect(await screen.findByText('Remove from Your Library')).toBeInTheDocument()
    expectRoute('/library')
    fireEvent.keyDown(document, { key: 'Escape' })
    const podcastLink = screen.getByRole('link', { name: new RegExp(podcast.title) })
    fireEvent.contextMenu(podcastLink.parentElement!, { clientX: 120, clientY: 80 })
    await waitFor(() => expect(screen.getByText('Open podcast')).toBeInTheDocument())
    expect(screen.queryByRole('menu', { name: 'Create playlist or folder' })).not.toBeInTheDocument()
    expectRoute('/library')
  })

  it('shows the recorded "Played" timestamp for items, and a dash when never played', () => {
    // Recent play recorded for the playlist; the album has never been played.
    window.localStorage.setItem('ns-play-history', JSON.stringify({ 'playlist:pl-played': new Date().toISOString() }))
    useUiStore.setState({ libraryExpanded: true })
    useLibraryStore.setState({
      savedPlaylists: [{
        id: 'pl-played', name: 'Played Playlist', coverUrl: null, isOwner: true,
        owner: { name: 'You' }, createdAt: '2020-01-01T00:00:00Z', tracks: [],
      }] as never,
      savedAlbums: [{
        id: 'al-cold', title: 'Cold Album', type: 'album', coverUrl: null,
        artist: { id: 'ar1', name: 'Artist' },
      }] as never,
    })
    renderSidebar()

    const playedRow = screen.getByRole('link', { name: /Played Playlist/ }).closest('.group\\/row')!
    expect(playedRow).toHaveTextContent('Today')

    const coldRow = screen.getByRole('link', { name: /Cold Album/ }).closest('.group\\/row')!
    expect(coldRow).toHaveTextContent('—')
  })

  it('floats pinned items to the top and reflects live pin changes', () => {
    useUiStore.setState({ libraryExpanded: true })
    useLibraryStore.setState({
      savedPlaylists: [
        { id: 'a', name: 'Alpha', coverUrl: null, isOwner: true, owner: { name: 'You' }, createdAt: '2020-01-01T00:00:00Z', tracks: [] },
        { id: 'b', name: 'Beta', coverUrl: null, isOwner: true, owner: { name: 'You' }, createdAt: '2020-01-02T00:00:00Z', tracks: [] },
      ] as never,
      savedVideos: [], savedPodcasts: [],
    })
    // Beta is pinned → it should lead the list ahead of Alpha.
    window.localStorage.setItem('ns-library-pinned', JSON.stringify(['pl-b']))
    renderSidebar()

    const alpha = screen.getByRole('link', { name: /Alpha/ })
    const beta = screen.getByRole('link', { name: /Beta/ })
    expect(beta.compareDocumentPosition(alpha) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // Re-pin Alpha live: it should now jump ahead of Beta without a remount.
    act(() => {
      window.localStorage.setItem('ns-library-pinned', JSON.stringify(['pl-a']))
      window.dispatchEvent(new CustomEvent('ns-pinned-change'))
    })
    expect(alpha.compareDocumentPosition(beta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('offers Pin to top in a row menu and persists the pin', async () => {
    useLibraryStore.setState({
      savedPlaylists: [
        { id: 'a', name: 'Alpha', coverUrl: null, isOwner: true, owner: { name: 'You' }, createdAt: '2020-01-01T00:00:00Z', tracks: [] },
      ] as never,
      savedVideos: [], savedPodcasts: [],
    })
    renderSidebar()

    const row = screen.getByRole('link', { name: /Alpha/ }).closest('.group\\/row')!
    fireEvent.contextMenu(row, { clientX: 100, clientY: 80 })

    const pin = await screen.findByText('Pin to top')
    fireEvent.click(pin)

    const pinned = JSON.parse(window.localStorage.getItem('ns-library-pinned') ?? '[]')
    expect(pinned).toContain('pl-a')
  })

  describe('drag-and-drop reordering (bug 26)', () => {
    const twoPlaylists = () => {
      useLibraryStore.setState({
        savedPlaylists: [
          { id: 'a', name: 'Alpha', coverUrl: null, isOwner: true, owner: { name: 'You' }, createdAt: '2020-01-01T00:00:00Z', tracks: [] },
          { id: 'b', name: 'Beta', coverUrl: null, isOwner: true, owner: { name: 'You' }, createdAt: '2020-01-02T00:00:00Z', tracks: [] },
        ] as never,
        savedVideos: [], savedPodcasts: [],
      })
    }

    // jsdom drag events don't carry a real DataTransfer; this mimics the bits we use.
    const makeDataTransfer = () => {
      const store: Record<string, string> = {}
      return {
        effectAllowed: '', dropEffect: '',
        setData: (type: string, val: string) => { store[type] = String(val) },
        getData: (type: string) => store[type] ?? '',
        get types() { return Object.keys(store) },
      }
    }

    const rowFor = (name: RegExp) => screen.getByRole('link', { name }).closest('.group\\/row')!

    it('reorders a playlist by drag-and-drop, persists the order, and switches to Custom sort', () => {
      twoPlaylists()
      renderSidebar()

      const dt = makeDataTransfer()
      // Drag Alpha and drop it onto the lower half of Beta → Alpha lands after Beta.
      fireEvent.dragStart(rowFor(/Alpha/), { dataTransfer: dt })
      fireEvent.dragOver(rowFor(/Beta/), { dataTransfer: dt, clientY: 50 })
      fireEvent.drop(rowFor(/Beta/), { dataTransfer: dt, clientY: 50 })

      expect(JSON.parse(window.localStorage.getItem('ns-library-order') ?? '[]')).toEqual(['pl-b', 'pl-a'])
      expect(window.localStorage.getItem('ns-library-sort')).toBe('custom')

      const alpha = screen.getByRole('link', { name: /Alpha/ })
      const beta = screen.getByRole('link', { name: /Beta/ })
      expect(beta.compareDocumentPosition(alpha) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('also reorders from the minimized rail', () => {
      twoPlaylists()
      window.localStorage.setItem('ns-sidebar-width', '72') // minimized rail
      renderSidebar()

      const dt = makeDataTransfer()
      const alphaRail = screen.getByRole('link', { name: 'Alpha' }).closest('.group\\/row')!
      const betaRail = screen.getByRole('link', { name: 'Beta' }).closest('.group\\/row')!
      fireEvent.dragStart(alphaRail, { dataTransfer: dt })
      fireEvent.dragOver(betaRail, { dataTransfer: dt, clientY: 50 })
      fireEvent.drop(betaRail, { dataTransfer: dt, clientY: 50 })

      expect(JSON.parse(window.localStorage.getItem('ns-library-order') ?? '[]')).toEqual(['pl-b', 'pl-a'])
    })

    it('restores the saved custom order on reload', () => {
      twoPlaylists()
      // Simulate a previous session: Beta before Alpha, custom sort persisted.
      window.localStorage.setItem('ns-library-order', JSON.stringify(['pl-b', 'pl-a']))
      window.localStorage.setItem('ns-library-sort', 'custom')
      renderSidebar()

      const alpha = screen.getByRole('link', { name: /Alpha/ })
      const beta = screen.getByRole('link', { name: /Beta/ })
      expect(beta.compareDocumentPosition(alpha) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('reorders playlists under the Playlists filter while preserving hidden items', () => {
      useLibraryStore.setState({
        savedPlaylists: [
          { id: 'a', name: 'Alpha', coverUrl: null, isOwner: true, owner: { name: 'You' }, createdAt: '2020-01-01T00:00:00Z', tracks: [] },
          { id: 'b', name: 'Beta', coverUrl: null, isOwner: true, owner: { name: 'You' }, createdAt: '2020-01-02T00:00:00Z', tracks: [] },
        ] as never,
        savedAlbums: [
          { id: 'x', title: 'Xanadu', type: 'album', coverUrl: null, artist: { name: 'Rush' } },
        ] as never,
        savedVideos: [], savedPodcasts: [],
      })
      renderSidebar()

      // Narrow to just playlists, then drag Alpha below Beta.
      fireEvent.click(screen.getByRole('button', { name: 'Playlists' }))
      const dt = makeDataTransfer()
      fireEvent.dragStart(rowFor(/Alpha/), { dataTransfer: dt })
      fireEvent.dragOver(rowFor(/Beta/), { dataTransfer: dt, clientY: 50 })
      fireEvent.drop(rowFor(/Beta/), { dataTransfer: dt, clientY: 50 })

      // Playlists swapped, and the filtered-out album keeps its place in the saved order.
      expect(JSON.parse(window.localStorage.getItem('ns-library-order') ?? '[]')).toEqual(['pl-b', 'pl-a', 'al-x'])
      expect(window.localStorage.getItem('ns-library-sort')).toBe('custom')
    })
  })

  it('opens the create menu only on blank library space and reuses both create actions', async () => {
    const { container } = renderSidebar()
    const blankSpace = container.querySelector('[data-sidebar-empty-space="true"]')!

    fireEvent.contextMenu(blankSpace, { clientX: 80, clientY: 140 })
    const createMenu = screen.getByRole('menu', { name: 'Create playlist or folder' })
    expect(createMenu).toBeInTheDocument()
    expect(createMenu.parentElement).toBe(document.body)
    expect(createMenu).toHaveClass('z-[1000]', 'w-64', 'text-sm', 'font-normal')
    expect(screen.getByRole('menuitem', { name: 'Create folder' })).toHaveClass('min-h-10', 'font-normal')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create folder' }))

    const folders = JSON.parse(window.localStorage.getItem('ns-library-folders') ?? '[]') as Array<{ name: string }>
    expect(folders).toHaveLength(1)
    expect(folders[0].name).toBe('New Folder')

    fireEvent.contextMenu(blankSpace, { clientX: 90, clientY: 150 })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create playlist' }))

    await waitFor(() => expect(createPlaylistMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expectRoute('/playlist/created-playlist'))
  })

  it('keeps the regular Create dropdown above the Home surface', () => {
    const { container } = renderSidebar()
    fireEvent.click(screen.getByRole('button', { name: 'Create playlist or folder' }))

    expect(screen.getByRole('menu')).toHaveClass('z-[9999]')
    expect(container.querySelector('aside')).toHaveClass('z-30')
  })

  it('keeps the library slide transition active while expanding and minimizing', () => {
    const { container } = renderSidebar()
    const sidebar = container.querySelector('aside')!

    expect(sidebar).toHaveStyle({ flexGrow: '0' })
    expect(sidebar).toHaveClass('library-sidebar-motion')

    fireEvent.click(screen.getByRole('button', { name: 'Expand Your Library' }))
    expect(sidebar).toHaveStyle({ flexGrow: '1' })
    expect(sidebar).toHaveClass('library-sidebar-motion')

    fireEvent.click(screen.getByRole('button', { name: 'Minimize Your Library' }))
    expect(sidebar).toHaveStyle({ flexGrow: '0' })
    expect(sidebar).toHaveClass('library-sidebar-motion')
  })

  it('opens the create context menu from the Your Library header and title', () => {
    const { container } = renderSidebar()
    const header = container.querySelector('[data-sidebar-header-space="true"]')!

    fireEvent.contextMenu(header, { clientX: 120, clientY: 72 })
    let menu = screen.getByRole('menu', { name: 'Create playlist or folder' })
    expect(menu).toBeInTheDocument()
    fireEvent.click(menu.previousElementSibling!)

    const titleButton = screen.getByText('Your Library').closest('button')!
    fireEvent.contextMenu(titleButton, { clientX: 80, clientY: 72 })
    menu = screen.getByRole('menu', { name: 'Create playlist or folder' })
    expect(menu).toBeInTheDocument()
  })

  describe('folder dropdown consistency (bug 25)', () => {
    const setupFolder = () => {
      window.localStorage.setItem('ns-library-folders', JSON.stringify([{
        id: 'media-folder', name: 'Saved media',
        itemKeys: [`vid-${video.id}`], collapsed: false,
      }]))
    }

    it('opens the folder menu on right-click and closes it on an outside click', () => {
      setupFolder()
      renderSidebar()
      const folderRow = screen.getByText('Saved media').closest('.group\\/folder')!

      fireEvent.contextMenu(folderRow)
      expect(screen.getByText('Rename')).toBeInTheDocument()
      expect(screen.getByText('Delete folder')).toBeInTheDocument()

      // The portal backdrop covers the viewport; mousedown on it closes the menu.
      const backdrop = document.body.querySelector('.fixed.inset-0.z-\\[9998\\]') as HTMLElement
      expect(backdrop).toBeTruthy()
      fireEvent.mouseDown(backdrop)
      expect(screen.queryByText('Delete folder')).not.toBeInTheDocument()
    })

    it('toggles the folder menu from the options button and closes on Escape', () => {
      setupFolder()
      renderSidebar()

      fireEvent.click(screen.getByRole('button', { name: 'Folder options' }))
      expect(screen.getByText('Delete folder')).toBeInTheDocument()

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByText('Delete folder')).not.toBeInTheDocument()
    })
  })

  it('does not treat controls or selected text as blank sidebar space', () => {
    const { container } = renderSidebar()
    const blankSpace = container.querySelector('[data-sidebar-empty-space="true"]')!
    const mediaLink = screen.getByRole('link', { name: new RegExp(video.title) })

    fireEvent.contextMenu(mediaLink, { clientX: 40, clientY: 40 })
    expect(screen.queryByRole('menu', { name: 'Create playlist or folder' })).not.toBeInTheDocument()

    const selection = window.getSelection()
    selection?.selectAllChildren(blankSpace)
    fireEvent.contextMenu(blankSpace, { clientX: 40, clientY: 40 })
    expect(screen.queryByRole('menu', { name: 'Create playlist or folder' })).not.toBeInTheDocument()
    selection?.removeAllRanges()
  })

  // ── bug 32: drag items into folders ────────────────────────────────

  describe('drag items into folders (bug 32)', () => {
    const makeDataTransfer = () => {
      const store: Record<string, string> = {}
      return {
        effectAllowed: '', dropEffect: '',
        setData: (type: string, val: string) => { store[type] = String(val) },
        getData: (type: string) => store[type] ?? '',
        get types() { return Object.keys(store) },
      }
    }

    const setupWithFolder = (folderItemKeys: string[] = []) => {
      useLibraryStore.setState({
        savedPlaylists: [
          { id: 'pl-one', name: 'Playlist One', coverUrl: null, isOwner: true, owner: { name: 'You' }, createdAt: '2020-01-01T00:00:00Z', tracks: [] },
          { id: 'pl-two', name: 'Playlist Two', coverUrl: null, isOwner: true, owner: { name: 'You' }, createdAt: '2020-01-02T00:00:00Z', tracks: [] },
          { id: 'pl-three', name: 'Playlist Three', coverUrl: null, isOwner: true, owner: { name: 'You' }, createdAt: '2020-01-03T00:00:00Z', tracks: [] },
        ] as never,
        savedAlbums: [
          { id: 'al-one', title: 'Album One', type: 'album', coverUrl: null, artist: { id: 'ar-x', name: 'Artist X', imageUrl: null } },
        ] as never,
        savedAlbumIds: new Set(['al-one']),
        savedVideos: [], savedPodcasts: [],
      })
      window.localStorage.setItem('ns-library-folders', JSON.stringify([{
        id: 'folder-a', name: 'Folder A',
        itemKeys: folderItemKeys, collapsed: false,
      }]))
    }

    it('drags a playlist into a folder', () => {
      setupWithFolder()
      renderSidebar()

      const dt = makeDataTransfer()
      dt.setData('application/x-ns-library-reorder', 'pl-one')

      const folderHeader = screen.getByText('Folder A').closest('.group\\/folder')!
      fireEvent.dragOver(folderHeader, { dataTransfer: dt })
      fireEvent.drop(folderHeader, { dataTransfer: dt })

      const folders = JSON.parse(window.localStorage.getItem('ns-library-folders') ?? '[]')
      expect(folders[0].itemKeys).toContain('pl-one')
    })

    it('shows visual feedback when dragging over a folder', () => {
      setupWithFolder()
      renderSidebar()

      const dt = makeDataTransfer()
      dt.setData('application/x-ns-library-reorder', 'pl-one')

      const folderHeader = screen.getByText('Folder A').closest('.group\\/folder')!
      fireEvent.dragOver(folderHeader, { dataTransfer: dt })

      // The folder row should get a green box-shadow when drag-over is active
      const style = folderHeader.getAttribute('style') ?? ''
      expect(style).toContain('box-shadow')
    })

    it('drags an album into a folder', () => {
      setupWithFolder()
      renderSidebar()

      const dt = makeDataTransfer()
      dt.setData('application/x-ns-library-reorder', 'al-one')

      const folderHeader = screen.getByText('Folder A').closest('.group\\/folder')!
      fireEvent.dragOver(folderHeader, { dataTransfer: dt })
      fireEvent.drop(folderHeader, { dataTransfer: dt })

      const folders = JSON.parse(window.localStorage.getItem('ns-library-folders') ?? '[]')
      expect(folders[0].itemKeys).toContain('al-one')
    })

    it('removes an item from its folder when dragged out', () => {
      setupWithFolder(['pl-one'])
      renderSidebar()

      // The playlist should render inside the folder (collapsed section expanded)
      expect(screen.getByText('Playlist One')).toBeInTheDocument()

      const dt = makeDataTransfer()
      dt.setData('application/x-ns-library-reorder', 'pl-one')

      // Simulate dropping on the library surface (not on a folder or row).
      // Use the scrollable body — it's the second [data-sidebar-empty-space].
      const librarySurface = document.querySelectorAll('[data-sidebar-empty-space="true"]')[1] as HTMLElement
      fireEvent.dragOver(librarySurface, { dataTransfer: dt })
      fireEvent.drop(librarySurface, { dataTransfer: dt })

      const folders = JSON.parse(window.localStorage.getItem('ns-library-folders') ?? '[]')
      expect(folders[0].itemKeys).not.toContain('pl-one')
    })

    it('prevents dragging a folder into itself', () => {
      setupWithFolder()
      renderSidebar()

      const dt = makeDataTransfer()
      dt.setData('application/x-ns-library-reorder', 'fold-folder-a')

      const folderHeader = screen.getByText('Folder A').closest('.group\\/folder')!
      fireEvent.dragOver(folderHeader, { dataTransfer: dt })
      fireEvent.drop(folderHeader, { dataTransfer: dt })

      // The folder should NOT contain itself
      const folders = JSON.parse(window.localStorage.getItem('ns-library-folders') ?? '[]')
      expect(folders[0].itemKeys).not.toContain('fold-folder-a')
    })

    it('prevents circular nesting', () => {
      // Folder B is inside Folder A. Dragging Folder A into Folder B would create a cycle.
      window.localStorage.setItem('ns-library-folders', JSON.stringify([
        { id: 'folder-a', name: 'Folder A', itemKeys: ['fold-folder-b'], collapsed: false },
        { id: 'folder-b', name: 'Folder B', itemKeys: [], collapsed: false },
      ]))
      renderSidebar()

      const dt = makeDataTransfer()
      dt.setData('application/x-ns-library-reorder', 'fold-folder-a')

      // Folder B is rendered inside Folder A. Use getAllByText since it also
      // appears as a root-level folder (filtered out after the parent fix).
      const allB = screen.getAllByText('Folder B')
      const folderB = allB[allB.length - 1].closest('.group\\/folder')!
      fireEvent.dragOver(folderB, { dataTransfer: dt })
      fireEvent.drop(folderB, { dataTransfer: dt })

      // Folder B should NOT contain Folder A
      const folders = JSON.parse(window.localStorage.getItem('ns-library-folders') ?? '[]')
      const folderBData = folders.find((f: { id: string }) => f.id === 'folder-b')
      expect(folderBData.itemKeys).not.toContain('fold-folder-a')
    })

    it('prevents nesting beyond max depth', () => {
      // Chain: Folder A → Folder B → Folder C → Folder D (depth 0, 1, 2, 3)
      // Folder D is at depth 3 — putting anything inside it exceeds MAX_FOLDER_DEPTH
      window.localStorage.setItem('ns-library-folders', JSON.stringify([
        { id: 'folder-a', name: 'Folder A', itemKeys: ['fold-folder-b'], collapsed: false },
        { id: 'folder-b', name: 'Folder B', itemKeys: ['fold-folder-c'], collapsed: false },
        { id: 'folder-c', name: 'Folder C', itemKeys: ['fold-folder-d'], collapsed: false },
        { id: 'folder-d', name: 'Folder D', itemKeys: [], collapsed: false },
        { id: 'folder-e', name: 'Folder E', itemKeys: [], collapsed: false },
      ]))
      renderSidebar()

      // Try to nest Folder E inside Folder D (which is already at depth 3)
      const dt = makeDataTransfer()
      dt.setData('application/x-ns-library-reorder', 'fold-folder-e')

      // Find Folder D inside the nested structure — it's rendered at depth 3 inside Folder C
      const allFolderDs = screen.getAllByText('Folder D')
      const folderD = allFolderDs[allFolderDs.length - 1].closest('.group\\/folder')!
      fireEvent.dragOver(folderD, { dataTransfer: dt })
      fireEvent.drop(folderD, { dataTransfer: dt })

      // Folder D should NOT contain Folder E (depth limit exceeded)
      const folders = JSON.parse(window.localStorage.getItem('ns-library-folders') ?? '[]')
      const folderDData = folders.find((f: { id: string }) => f.id === 'folder-d')
      expect(folderDData.itemKeys).not.toContain('fold-folder-e')
    })

    it('renders nested folders inside their parent', () => {
      // Set up library data AND folders in one go — don't call setupWithFolder as
      // it would overwrite the localStorage with a single folder.
      useLibraryStore.setState({
        savedPlaylists: [
          { id: 'pl-one', name: 'Playlist One', coverUrl: null, isOwner: true, owner: { name: 'You' }, createdAt: '2020-01-01T00:00:00Z', tracks: [] },
          { id: 'pl-two', name: 'Playlist Two', coverUrl: null, isOwner: true, owner: { name: 'You' }, createdAt: '2020-01-02T00:00:00Z', tracks: [] },
        ] as never,
        savedAlbums: [] as never, savedAlbumIds: new Set(),
        savedVideos: [], savedPodcasts: [],
      } as never)
      window.localStorage.setItem('ns-library-folders', JSON.stringify([
        { id: 'folder-a', name: 'Folder A', itemKeys: ['fold-folder-b', 'pl-one'], collapsed: false },
        { id: 'folder-b', name: 'Folder B', itemKeys: ['pl-two'], collapsed: false },
      ]))
      renderSidebar()

      // Both parent and child folders should render at least once
      expect(screen.getByText('Folder A')).toBeInTheDocument()
      expect(screen.getAllByText('Folder B').length).toBeGreaterThanOrEqual(1)
      // Items inside nested folders should render
      expect(screen.getByText('Playlist Two')).toBeInTheDocument()
    })
  })
})
