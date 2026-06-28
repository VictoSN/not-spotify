import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ArtistCard } from '@/components/cards/ArtistCard'
import { PopularArtistsPage } from './PopularArtistsPage'

const artist = vi.hoisted(() => ({
  id: 'responsive-artist',
  name: 'Responsive Artist',
  bio: null,
  imageUrl: '/responsive-artist.jpg',
  headerImageUrl: null,
  monthlyListeners: 12_000_000,
  genres: ['pop'],
  followerCount: 100,
  verified: true,
  socialLinks: {},
  createdAt: '2026-01-01T00:00:00Z',
}))

vi.mock('@/services/artistService', () => ({
  artistService: {
    getPopular: vi.fn(() => Promise.resolve([artist])),
    getTopTracks: vi.fn(() => Promise.resolve([])),
  },
}))

describe('PopularArtistsPage responsive grid', () => {
  it('uses fluid cards that reflow with the available center-panel width', async () => {
    render(
      <MemoryRouter>
        <PopularArtistsPage />
      </MemoryRouter>,
    )

    const grid = await screen.findByTestId('popular-artists-grid')
    expect(grid).toHaveClass(
      'grid',
      '[grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))]',
    )
    expect(screen.getByText(artist.name).closest('.group')).toHaveClass('w-full', 'min-w-0')
  })

  it('keeps the standard artist card width outside the Popular Artists page', () => {
    render(
      <MemoryRouter>
        <ArtistCard artist={artist} />
      </MemoryRouter>,
    )

    expect(screen.getByText(artist.name).closest('.group')).toHaveClass('w-40', 'sm:w-44')
    expect(screen.getByText(artist.name).closest('.group')).not.toHaveClass('w-full')
  })
})
