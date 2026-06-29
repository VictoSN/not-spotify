import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GenreDetailPage } from './GenreDetailPage'
import { curatedBrowseCategories, getBrowseFallbackRows } from '@/data/browseContent'
import type { Artist } from '@/types/artist'
import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'
import { useAuthStore } from '@/stores/authStore'
import { usePlayerStore } from '@/stores/playerStore'

// HorizontalScroller observes its viewport size.
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

// No API genre/tracks/playlists → only the editorial showcase rows render, so the
// only "Show all" / cards on the page are the discover showcases under test.
vi.mock('@/services/genreService', () => ({
  genreService: {
    getBySlug: vi.fn(() => Promise.reject(new Error('no api genre'))),
    getTracksByGenre: vi.fn(() => Promise.resolve([])),
    getPlaylistsByGenre: vi.fn(() => Promise.resolve([])),
    getArtistsByGenre: vi.fn(() => Promise.resolve([])),
  },
}))

vi.mock('@/services/searchService', () => ({
  searchService: {
    search: vi.fn(() =>
      Promise.resolve({ tracks: [], tracksByLyrics: [], artists: [], albums: [], playlists: [] }),
    ),
  },
}))

function renderGenre(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/genres/${slug}`]}>
      <Routes>
        <Route path="/genres/:slug" element={<GenreDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// Bug #2: a discover/showcase "Show all" (and its cards) used to run a text search
// for the showcase's name (e.g. search("New Music Friday")), which matches no
// catalogue track. They must now open a real track-list route instead.
describe('GenreDetailPage discover showcases (bug #2)', () => {
  it('routes the showcase "Show all" to a real track-list route, not a search', async () => {
    renderGenre('music')

    const showAll = await screen.findByRole('link', { name: 'Show all' })
    expect(showAll).toHaveAttribute('href', '/new-releases')
    expect(showAll.getAttribute('href')).not.toMatch(/\/search/)
  })

  it('routes showcase cards to real destinations instead of a name search', async () => {
    renderGenre('music')

    const newMusicFriday = await screen.findByRole('link', { name: /New Music Friday/ })
    const discoverWeekly = screen.getByRole('link', { name: /Discover Weekly/ })

    expect(newMusicFriday).toHaveAttribute('href', '/new-releases')
    expect(discoverWeekly).toHaveAttribute('href', '/recommended-tracks')

    for (const link of [newMusicFriday, discoverWeekly]) {
      expect(link.getAttribute('href')).not.toMatch(/\/search\?q=/)
    }
  })
})

// The same guarantee, asserted on the data the page renders from — robust against
// any future re-layout of the showcase rows.
describe('browse showcase routing data (bug #2)', () => {
  it('never points a curated showcase card at a name→search query', () => {
    const items = curatedBrowseCategories.flatMap((c) => c.rows ?? []).flatMap((r) => r.items)
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item.href ?? '').not.toMatch(/\/search/)
    }
  })

  it('maps the canonical discover playlists to their real routes', () => {
    const discover = curatedBrowseCategories.find((c) => c.slug === 'music')?.rows?.[0]
    const hrefOf = (title: string) => discover?.items.find((i) => i.title === title)?.href

    expect(hrefOf('New Music Friday')).toBe('/new-releases')
    expect(hrefOf('Discover Weekly')).toBe('/recommended-tracks')
    expect(hrefOf('Release Radar')).toBe('/new-releases')
    expect(discover?.href).toBe('/new-releases') // the row's "Show all"
  })

  it('routes generated fallback showcase rows to the genre page, not a search', () => {
    const rows = getBrowseFallbackRows('rock', 'Rock')
    const items = rows.flatMap((r) => r.items)

    expect(items.length).toBeGreaterThan(0)
    expect(rows[0].href).toBe('/genres/rock')
    for (const item of items) {
      expect(item.href).toBe('/genres/rock')
      expect(item.href ?? '').not.toMatch(/\/search/)
    }
  })
})

const rockTrack = {
  id: 'track-rock',
  title: 'Rock Anthem',
  artist: { id: 'artist-rock', name: 'The Rockers', imageUrl: '/artist.jpg' },
  album: { id: 'album-rock', title: 'Loud', coverUrl: '/album.jpg' },
} as Track

const rockPlaylist = {
  id: 'playlist-rock',
  name: 'Rock Essentials',
  description: 'The loudest essentials',
  coverUrl: '/playlist.jpg',
  isPublic: true,
  owner: { id: 'owner', name: 'Curator', avatarUrl: null },
  tracks: [{ track: rockTrack, addedAt: '2026-01-01T00:00:00Z', addedBy: { id: 'owner', name: 'Curator', avatarUrl: null } }],
} as unknown as Playlist

const rockArtist = {
  id: 'artist-rock',
  name: 'The Rockers',
  imageUrl: '/artist.jpg',
  monthlyListeners: 50_000,
  genres: ['rock'],
  socialLinks: {},
} as unknown as Artist

describe('GenreDetailPage genre content (bug #19)', () => {
  const originalAuthState = useAuthStore.getState()
  const originalPlayerState = usePlayerStore.getState()

  afterEach(() => {
    act(() => {
      useAuthStore.setState(originalAuthState, true)
      usePlayerStore.setState(originalPlayerState, true)
    })
  })

  it('shows relevant playlists, tracks, and popular artists with working links and play controls', async () => {
    const { genreService } = await import('@/services/genreService')
    vi.mocked(genreService.getBySlug).mockResolvedValueOnce({
      id: 'genre-rock',
      name: 'Rock',
      slug: 'rock',
      color: '#b91c1c',
      imageUrl: null,
    })
    vi.mocked(genreService.getPlaylistsByGenre).mockResolvedValueOnce([rockPlaylist])
    vi.mocked(genreService.getTracksByGenre).mockResolvedValueOnce([rockTrack])
    vi.mocked(genreService.getArtistsByGenre).mockResolvedValueOnce([rockArtist])
    const playContext = vi.fn()
    useAuthStore.setState({ isAuthenticated: true })
    usePlayerStore.setState({ playContext })

    renderGenre('rock')

    expect(await screen.findByText('Popular Rock playlists')).toBeInTheDocument()
    expect(screen.getByText('Rock tracks')).toBeInTheDocument()
    expect(screen.getByText('Popular Rock artists')).toBeInTheDocument()
    expect(document.querySelector('a[href="/playlist/playlist-rock"]')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Play Rock Essentials' }))
    expect(playContext).toHaveBeenCalledWith({ type: 'playlist', id: 'playlist-rock' }, [rockTrack], 0)
    expect(document.querySelector('a[href="/artist/artist-rock"]')).toBeInTheDocument()
  })
})
