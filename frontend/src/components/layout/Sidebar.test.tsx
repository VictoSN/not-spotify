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

    expect(screen.getByRole('menu')).toHaveClass('z-[1000]')
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

      // Clicking anywhere outside the menu (incl. outside the sidebar) closes it.
      fireEvent.mouseDown(document.body)
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
})
