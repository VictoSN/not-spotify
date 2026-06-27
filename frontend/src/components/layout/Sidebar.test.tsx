import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from './Sidebar'
import { useAuthStore } from '@/stores/authStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useRatingStore } from '@/stores/ratingStore'
import { useUiStore } from '@/stores/uiStore'
import type { MusicVideo } from '@/types/musicVideo'
import type { PodcastSummary } from '@/types/podcast'

class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const originalAuthState = useAuthStore.getState()
const originalLibraryState = useLibraryStore.getState()
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
      useRatingStore.setState(originalRatingState, true)
      useUiStore.setState(originalUiState, true)
    })
    window.localStorage.clear()
  })

  const expectRoute = (route: string) =>
    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent(route)

  it('navigates saved MV and podcast rows in the expanded list layout', () => {
    renderSidebar()
    fireEvent.click(screen.getByRole('link', { name: new RegExp(video.title) }))
    expectRoute(`/videos/${video.id}`)
    fireEvent.click(screen.getByRole('link', { name: new RegExp(podcast.title) }))
    expectRoute(`/podcasts/${podcast.id}`)
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
