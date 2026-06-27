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

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const originalAuthState = useAuthStore.getState()
const originalLibraryState = useLibraryStore.getState()
const originalRatingState = useRatingStore.getState()
const originalUiState = useUiStore.getState()

const video: MusicVideo = {
  id: 'video-14',
  title: 'Phase Fourteen Video',
  description: null,
  artist: { id: 'artist-14', name: 'Sidebar Artist', imageUrl: null },
  trackId: null,
  videoUrl: '/phase-14.mp4',
  thumbnailUrl: '/phase-14.jpg',
  durationMs: 120_000,
  viewCount: 14,
  createdAt: '2026-06-27T00:00:00Z',
}

const podcast: PodcastSummary = {
  id: 'podcast-14',
  title: 'Phase Fourteen Podcast',
  author: 'Sidebar Host',
  description: null,
  category: 'Technology',
  imageUrl: '/phase-14-podcast.jpg',
  episodeCount: 14,
  createdAt: '2026-06-27T00:00:00Z',
}

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="current route">{location.pathname}</output>
}

function renderSidebar(initialEntry = '/library') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Sidebar />
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('Sidebar saved media navigation', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.setState({ isAuthenticated: true })
    useUiStore.setState({ libraryExpanded: false })
    useRatingStore.setState({ loadFromBackend: vi.fn(async () => {}) })
    useLibraryStore.setState({
      savedPlaylists: [],
      likedSongs: [],
      followedArtists: [],
      savedAlbums: [],
      savedVideos: [video],
      savedPodcasts: [podcast],
      likedTrackIds: new Set(),
      followedArtistIds: new Set(),
      savedAlbumIds: new Set(),
      savedVideoIds: new Set([video.id]),
      savedPodcastIds: new Set([podcast.id]),
      fetchLibrary: vi.fn(async () => {}),
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

  it('navigates saved MV and podcast rows in the expanded list layout', () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('link', { name: new RegExp(video.title) }))
    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent(`/videos/${video.id}`)

    fireEvent.click(screen.getByRole('link', { name: new RegExp(podcast.title) }))
    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent(`/podcasts/${podcast.id}`)
  })

  it('keeps saved MV and podcast navigation working in the minimized rail', () => {
    window.localStorage.setItem('ns-sidebar-width', '72')
    renderSidebar()

    fireEvent.click(screen.getByRole('link', { name: video.title }))
    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent(`/videos/${video.id}`)

    fireEvent.click(screen.getByRole('link', { name: podcast.title }))
    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent(`/podcasts/${podcast.id}`)
  })

  it('keeps saved MV and podcast navigation working in grid layout', () => {
    window.localStorage.setItem('ns-library-view', 'grid')
    renderSidebar()

    fireEvent.click(screen.getByRole('link', { name: new RegExp(video.title) }))
    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent(`/videos/${video.id}`)

    fireEvent.click(screen.getByRole('link', { name: new RegExp(podcast.title) }))
    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent(`/podcasts/${podcast.id}`)
  })

  it('keeps saved MV and podcast navigation working inside a library folder', () => {
    window.localStorage.setItem('ns-library-folders', JSON.stringify([{
      id: 'media-folder',
      name: 'Saved media',
      itemKeys: [`vid-${video.id}`, `pod-${podcast.id}`],
      collapsed: false,
    }]))
    renderSidebar()

    fireEvent.click(screen.getByRole('link', { name: new RegExp(video.title) }))
    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent(`/videos/${video.id}`)

    fireEvent.click(screen.getByRole('link', { name: new RegExp(podcast.title) }))
    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent(`/podcasts/${podcast.id}`)
  })

  it('opens media menus by trigger and right-click without navigating the row', async () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: `More options for ${video.title}` }))
    expect(await screen.findByText('Remove from Your Library')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent('/library')

    fireEvent.keyDown(document, { key: 'Escape' })
    const podcastLink = screen.getByRole('link', { name: new RegExp(podcast.title) })
    fireEvent.contextMenu(podcastLink.parentElement!, { clientX: 120, clientY: 80 })

    await waitFor(() => expect(screen.getByText('Open podcast')).toBeInTheDocument())
    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent('/library')
  })
})
