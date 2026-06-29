import React from 'react'
import { act } from 'react'
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
    album: { id: `album-${id}`, title: 'Album', coverUrl: `/covers/${id}.jpg`, releaseDate: '2020-01-01', type: 'album' },
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

async function renderRecents() {
  const result = render(
    <MemoryRouter initialEntries={['/recents']}>
      <RecentsPage />
    </MemoryRouter>,
  )
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  return result
}

async function fireAndFlush(action: () => void) {
  await act(async () => {
    action()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('RecentsPage context menu', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.setState({ isAuthenticated: true })
      useLibraryStore.setState({ likedTrackIds: new Set() })
      useRatingStore.setState({ getAggregate: () => ({ ratingCount: 0, averageRating: 0 }) })
    })
    vi.spyOn(meService, 'getHistory').mockResolvedValue(history)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    act(() => {
      useAuthStore.setState(originalAuthState, true)
      useLibraryStore.setState(originalLibraryState, true)
      useRatingStore.setState(originalRatingState, true)
    })
  })

  it('opens the track menu when a Recents row is right-clicked', async () => {
    await renderRecents()

    const title = await screen.findByText('Track recent-1')
    const row = title.closest('.group')!
    await fireAndFlush(() => fireEvent.contextMenu(row, { clientX: 120, clientY: 80 }))

    await waitFor(() => expect(screen.getByText('Go to artist')).toBeInTheDocument())

    // The panel must keep its background box sized to its content even when the
    // anchor flips it upward (bug #4): overflow-visible! lets the flyout escape,
    // and max-h-none! stops Headless UI's injected max-height from clipping the
    // bg so lower items (Share, etc.) can't spill out without a background.
    const panel = screen.getByText('Go to artist').closest('[role="menu"]')!
    expect(panel.className).toContain('overflow-visible!')
    expect(panel.className).toContain('max-h-none!')
  })

  it('uses fluid cards in the responsive recently played grid', async () => {
    await renderRecents()

    const grid = await screen.findByTestId('recently-played-grid')
    expect(grid).toHaveClass('[grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))]')
    expect(screen.getByText('Track recent-1').closest('.group')).toHaveClass('w-full', 'min-w-0')
  })
})
