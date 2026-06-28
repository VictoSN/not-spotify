import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TrackCard } from './TrackCard'
import { useAuthStore } from '@/stores/authStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import type { Track } from '@/types/track'

class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal('ResizeObserver', ResizeObserverStub)
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}))

const track: Track = {
  id: 'track-card-menu',
  title: 'Menu Song',
  durationMs: 180_000,
  audioUrl: '/menu-song.mp3',
  previewUrl: null,
  trackNumber: 1,
  discNumber: 1,
  explicit: false,
  playCount: 0,
  ratingCount: 0,
  averageRating: 0,
  artist: { id: 'artist-card-menu', name: 'Menu Artist', imageUrl: null },
  album: { id: 'album-card-menu', title: 'Menu Album', coverUrl: '/menu.jpg', releaseDate: '2026-01-01', type: 'album' },
  genres: [],
  createdAt: '2026-01-01T00:00:00Z',
}

const originalAuthState = useAuthStore.getState()
const originalLibraryState = useLibraryStore.getState()
const originalPlayerState = usePlayerStore.getState()

describe('TrackCard menu interactions', () => {
  const play = vi.fn()

  beforeEach(() => {
    play.mockClear()
    useAuthStore.setState({ isAuthenticated: true })
    useLibraryStore.setState({ likedTrackIds: new Set() })
    usePlayerStore.setState({
      currentTrack: null,
      isPlaying: false,
      currentContextType: null,
      queue: [],
      play,
    })
  })

  afterEach(() => {
    act(() => {
      useAuthStore.setState(originalAuthState, true)
      useLibraryStore.setState(originalLibraryState, true)
      usePlayerStore.setState(originalPlayerState, true)
    })
  })

  it('opens the more-options menu without playing the track', async () => {
    render(
      <MemoryRouter>
        <TrackCard track={track} queue={[track]} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'More options' }))

    expect(await screen.findByRole('menu')).toBeInTheDocument()
    expect(play).not.toHaveBeenCalled()
  })
})
