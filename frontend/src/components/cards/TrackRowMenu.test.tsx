import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TrackRowMenu } from './TrackRowMenu'
import { useAuthStore } from '@/stores/authStore'
import { useLibraryStore } from '@/stores/libraryStore'
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
  id: 'remove-track',
  title: 'Remove Me',
  durationMs: 180_000,
  audioUrl: '/remove.mp3',
  previewUrl: null,
  trackNumber: 1,
  discNumber: 1,
  explicit: false,
  playCount: 0,
  ratingCount: 0,
  averageRating: 0,
  artist: { id: 'remove-artist', name: 'Remove Artist', imageUrl: null },
  album: { id: 'remove-album', title: 'Remove Album', coverUrl: '/remove.jpg', releaseDate: '2026-01-01', type: 'album' },
  genres: [],
  createdAt: '2026-01-01T00:00:00Z',
}

const originalAuthState = useAuthStore.getState()
const originalLibraryState = useLibraryStore.getState()
const removeTrack = vi.fn(async () => {})

describe('TrackRowMenu current playlist action', () => {
  beforeEach(() => {
    removeTrack.mockClear()
    useAuthStore.setState({ isAuthenticated: true })
    useLibraryStore.setState({
      savedPlaylists: [],
      likedTrackIds: new Set(),
      removeTrackFromPlaylist: removeTrack,
    })
  })

  afterEach(() => {
    act(() => {
      useAuthStore.setState(originalAuthState, true)
      useLibraryStore.setState(originalLibraryState, true)
    })
  })

  it('removes directly from the open playlist even when it is absent from the library cache', async () => {
    const onRemoved = vi.fn()
    render(
      <MemoryRouter>
        <TrackRowMenu
          track={track}
          currentPlaylistId="current-playlist"
          onRemovedFromCurrentPlaylist={onRemoved}
          alwaysVisible
        />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    const menu = await screen.findByRole('menu')
    expect(menu).toHaveClass('w-64', 'text-sm', 'font-normal')
    const removeItem = screen.getByRole('menuitem', { name: 'Remove from this playlist' })
    expect(removeItem).toHaveClass('min-h-10', 'font-normal')
    fireEvent.click(removeItem)

    await waitFor(() => expect(removeTrack).toHaveBeenCalledWith('current-playlist', track.id))
    expect(removeTrack).toHaveBeenCalledTimes(1)
    expect(onRemoved).toHaveBeenCalledWith(track.id)
  })
})
