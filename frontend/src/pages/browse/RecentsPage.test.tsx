import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecentsPage } from './RecentsPage'
import { meService, type PlayHistoryItem } from '@/services/meService'
import { useAuthStore } from '@/stores/authStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useRatingStore } from '@/stores/ratingStore'
import type { Track } from '@/types/track'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

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

const track = (id: string): Track =>
  ({
    id,
    title: `Track ${id}`,
    durationMs: 180_000,
    audioUrl: `audio/${id}.mp3`,
    artist: { id: `artist-${id}`, name: 'Artist', imageUrl: null },
    album: { id: `album-${id}`, title: 'Album', coverUrl: '', releaseDate: '2020-01-01', type: 'album' },
    genres: [],
    playCount: 0,
    ratingCount: 0,
    averageRating: 0,
    previewUrl: null,
    trackNumber: 1,
    discNumber: 1,
    explicit: false,
    createdAt: '2020-01-01',
  }) as unknown as Track

const history: PlayHistoryItem[] = [
  { track: track('recent-1'), playedAt: '2026-06-27T10:00:00Z' },
]

const originalAuthState = useAuthStore.getState()
const originalLibraryState = useLibraryStore.getState()
const originalRatingState = useRatingStore.getState()

function renderRecents() {
  return render(
    <MemoryRouter initialEntries={['/recents']}>
      <RecentsPage />
    </MemoryRouter>,
  )
}

describe('RecentsPage context menu', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true })
    useLibraryStore.setState({ likedTrackIds: new Set() })
    useRatingStore.setState({ getAggregate: () => ({ ratingCount: 0, averageRating: 0 }) })
    vi.spyOn(meService, 'getHistory').mockResolvedValue(history)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useAuthStore.setState(originalAuthState, true)
    useLibraryStore.setState(originalLibraryState, true)
    useRatingStore.setState(originalRatingState, true)
  })

  it('opens the track menu when a Recents row is right-clicked', async () => {
    renderRecents()

    const titleLink = await screen.findByRole('link', { name: 'Track recent-1' })
    const row = titleLink.closest('.group')!
    fireEvent.contextMenu(row, { clientX: 120, clientY: 80 })

    await waitFor(() => expect(screen.getByText('Go to artist')).toBeInTheDocument())
  })

  it('keeps the ⋯ menu trigger available on Recents rows', async () => {
    renderRecents()

    expect(await screen.findByRole('button', { name: 'More options' })).toBeInTheDocument()
  })
})
