import React from 'react'
import { act } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecentsPage } from './RecentsPage'
import { meService, type PlayHistoryContext, type PlayHistoryItem } from '@/services/meService'
import { useAuthStore } from '@/stores/authStore'
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

const track = (id: string, overrides: Partial<Track> = {}): Track =>
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
    ...overrides,
  }) as unknown as Track

/** ISO timestamp `daysAgo` calendar days back at a fixed local hour. */
const playedAt = (daysAgo: number, hour: number) => {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, 30, 0, 0)
  return d.toISOString()
}

const playlistContext: PlayHistoryContext = {
  type: 'playlist',
  id: 'pl-1',
  name: 'forever favs',
  imageUrl: '/covers/playlist.jpg',
  ownerName: 'doreen',
  isExplicit: false,
}

const albumContext: PlayHistoryContext = {
  type: 'album',
  id: 'al-1',
  name: 'GREENGREEN',
  imageUrl: '/covers/album.jpg',
  ownerName: 'CORTIS',
  isExplicit: true,
}

const likedContext: PlayHistoryContext = {
  type: 'liked',
  id: 'liked',
  name: 'Liked Songs',
  imageUrl: null,
  ownerName: null,
  isExplicit: false,
}

// Newest first, like the API returns.
const history: PlayHistoryItem[] = [
  { track: track('p1'), playedAt: playedAt(0, 12), context: playlistContext },
  { track: track('p2'), playedAt: playedAt(0, 11), context: playlistContext },
  { track: track('a1'), playedAt: playedAt(0, 10), context: albumContext },
  { track: track('s1'), playedAt: playedAt(0, 9), context: null },
  { track: track('s2'), playedAt: playedAt(0, 8), context: null },
  { track: track('y1'), playedAt: playedAt(1, 12), context: playlistContext },
  { track: track('o1'), playedAt: playedAt(2, 12), context: likedContext },
]

const originalAuthState = useAuthStore.getState()

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

describe('RecentsPage grouped history', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.setState({ isAuthenticated: true })
    })
    vi.spyOn(meService, 'getHistory').mockResolvedValue(history)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    act(() => {
      useAuthStore.setState(originalAuthState, true)
    })
  })

  it('buckets plays into Today / Yesterday / dated sections', async () => {
    await renderRecents()

    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeInTheDocument()

    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const dated = twoDaysAgo.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    expect(screen.getByRole('heading', { name: dated })).toBeInTheDocument()
  })

  it('merges same-context plays per day with Spotify-style subtitles', async () => {
    await renderRecents()

    // Playlist rows lead with the play count; one row for today, one for yesterday.
    expect(screen.getAllByText('forever favs')).toHaveLength(2)
    expect(screen.getByText('2 songs played • Playlist • doreen')).toBeInTheDocument()
    expect(screen.getByText('1 song played • Playlist • doreen')).toBeInTheDocument()

    // Album rows lead with "Album • Artist" and show the explicit badge.
    expect(screen.getByText('GREENGREEN')).toBeInTheDocument()
    expect(screen.getByText('Album • CORTIS • 1 song played')).toBeInTheDocument()
    expect(screen.getByLabelText('Explicit')).toBeInTheDocument()

    // Liked Songs reads as a playlist.
    expect(screen.getByText('Liked Songs')).toBeInTheDocument()
    expect(screen.getByText('1 song played • Playlist')).toBeInTheDocument()
  })

  it('collects context-less plays into an anonymous "songs played" row', async () => {
    await renderRecents()

    const anonymous = screen.getByText('2 songs played')
    expect(anonymous).toBeInTheDocument()
    // The bucket has no subtitle and no link — nowhere to navigate to.
    expect(anonymous.closest('a')).toBeNull()
  })

  it('links context rows to their playlist/album pages', async () => {
    await renderRecents()

    const playlistLinks = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === '/playlist/pl-1')
    expect(playlistLinks.length).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('link').some((a) => a.getAttribute('href') === '/album/al-1'),
    ).toBe(true)
  })

  it('expands a row to reveal the individual plays', async () => {
    await renderRecents()

    expect(screen.queryByText('Track p1')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Show songs played from forever favs' })[0])

    expect(screen.getByText('Track p1')).toBeInTheDocument()
    expect(screen.getByText('Track p2')).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'Hide songs played from forever favs' }),
    ).toHaveLength(1)
  })

  it('asks visitors to log in without fetching history', async () => {
    act(() => {
      useAuthStore.setState({ isAuthenticated: false })
    })
    await renderRecents()

    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument()
    expect(meService.getHistory).not.toHaveBeenCalled()
  })
})
