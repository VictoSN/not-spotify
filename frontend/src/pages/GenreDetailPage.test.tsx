import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { GenreDetailPage } from './GenreDetailPage'
import { curatedBrowseCategories, getBrowseFallbackRows } from '@/data/browseContent'

// HorizontalScroller observes its viewport size.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

// No API genre/tracks/playlists → only the editorial showcase rows render, so the
// only "Show all" / cards on the page are the discover showcases under test.
vi.mock('@/services/genreService', () => ({
  genreService: {
    getBySlug: vi.fn(() => Promise.reject(new Error('no api genre'))),
    getTracksByGenre: vi.fn(() => Promise.resolve([])),
    getPlaylistsByGenre: vi.fn(() => Promise.resolve([])),
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
