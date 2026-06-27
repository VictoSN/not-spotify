import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaylistCard } from './PlaylistCard'
import { MixTile } from './MixTile'
import { TrackTile } from './TrackTile'
import { HomeVideoTile } from '@/pages/HomePage'
import { useAuthStore } from '@/stores/authStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'
import type { MusicVideo } from '@/types/musicVideo'
import type { DailyMix } from '@/services/trackService'

class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal('ResizeObserver', ResizeObserverStub)
vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
})))

const originalAuthState = useAuthStore.getState()
const originalLibraryState = useLibraryStore.getState()
const originalPlayerState = usePlayerStore.getState()

const track: Track = {
  id: 'track-15',
  title: 'Clickable Track Fifteen',
  durationMs: 180_000,
  audioUrl: '/track-15.mp3',
  previewUrl: null,
  trackNumber: 1,
  discNumber: 1,
  explicit: false,
  playCount: 15,
  ratingCount: 0,
  averageRating: 0,
  artist: { id: 'artist-15', name: 'Phase Artist', imageUrl: null },
  album: { id: 'album-15', title: 'Phase Album', coverUrl: '/album-15.jpg', releaseDate: '2026-01-01', type: 'album' },
  genres: ['test'],
  createdAt: '2026-01-01T00:00:00Z',
}

const playlist: Playlist = {
  id: 'playlist-15',
  name: 'Clickable Playlist Fifteen',
  description: 'Phase 15 navigation fixture',
  coverUrl: '/playlist-15.jpg',
  isPublic: true,
  owner: { id: 'user-15', name: 'Owner', avatarUrl: null },
  tracks: [],
  followerCount: 0,
  totalDurationMs: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const mix: DailyMix = {
  id: 'mix-15',
  title: 'Clickable Daily Mix Fifteen',
  subtitle: 'Daily Mix',
  color: '#1db954',
  tracks: [],
}

const video: MusicVideo = {
  id: 'video-15',
  title: 'Menu Video Fifteen',
  description: null,
  artist: { id: 'artist-15', name: 'Phase Artist', imageUrl: null },
  trackId: null,
  videoUrl: '/video-15.mp4',
  thumbnailUrl: '/video-15.jpg',
  durationMs: 120_000,
  viewCount: 15,
  createdAt: '2026-01-01T00:00:00Z',
}

function LocationProbe() {
  return <output aria-label="current route">{useLocation().pathname}</output>
}

function renderCards(children: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      {children}
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('Home card navigation', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true })
    useLibraryStore.setState({ savedPlaylists: [], savedVideoIds: new Set() })
  })

  afterEach(() => {
    act(() => {
      useAuthStore.setState(originalAuthState, true)
      useLibraryStore.setState(originalLibraryState, true)
      usePlayerStore.setState(originalPlayerState, true)
    })
  })

  it('routes playlist, mix, and track surfaces to their own detail pages', () => {
    renderCards(
      <>
        <PlaylistCard playlist={playlist} />
        <MixTile mix={mix} />
        <TrackTile track={track} />
      </>,
    )
    const route = () => screen.getByRole('status', { name: 'current route' })

    fireEvent.click(screen.getByText(playlist.name))
    expect(route()).toHaveTextContent(`/playlist/${playlist.id}`)
    fireEvent.click(screen.getByText(mix.title))
    expect(route()).toHaveTextContent(`/mix/${mix.id}`)
    fireEvent.click(screen.getByText(track.title))
    expect(route()).toHaveTextContent(`/track/${track.id}`)
  })

  it('does not navigate when nested play or menu controls are clicked', async () => {
    renderCards(
      <>
        <MixTile mix={mix} />
        <HomeVideoTile video={video} queue={[video]} />
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: `Play ${mix.title}` }))
    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent('/')

    fireEvent.click(screen.getByRole('button', { name: `More options for ${video.title}` }))
    expect(await screen.findByText('Play video')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent('/')
  })
})
