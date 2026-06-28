import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ArtistProfilePage } from './ArtistProfilePage'

const artist = vi.hoisted(() => ({
  id: 'artist-about',
  name: 'Showcase Artist',
  bio: 'A vivid artist biography that belongs over the image at the bottom of the About card.',
  imageUrl: '/artist-profile.jpg',
  headerImageUrl: '/artist-header.jpg',
  monthlyListeners: 12_345_678,
  genres: ['pop'],
  followerCount: 500_000,
  verified: true,
  socialLinks: {},
  createdAt: '2026-01-01T00:00:00Z',
}))

vi.mock('@/services/artistService', () => ({
  artistService: {
    getById: vi.fn(() => Promise.resolve(artist)),
    getTopTracks: vi.fn(() => Promise.resolve([])),
    getAlbums: vi.fn(() => Promise.resolve([])),
    getRelated: vi.fn(() => Promise.resolve([])),
    getTourDates: vi.fn(() => Promise.resolve([{
      id: 'tour-date',
      eventDate: '2026-08-10T20:00:00Z',
      city: 'Kuala Lumpur',
      venue: 'National Stadium',
      country: 'MY',
      ticketUrl: null,
      songs: [],
    }])),
  },
}))

vi.mock('@/services/trackService', () => ({
  trackService: { getByAlbum: vi.fn(() => Promise.resolve([])) },
}))

vi.mock('@/hooks/useDominantColor', () => ({
  useDominantColor: () => null,
  artworkSectionGradient: () => 'none',
  withAlpha: (color: string) => color,
}))

describe('ArtistProfilePage About section', () => {
  it('renders the cinematic About card directly after On tour without merch', async () => {
    render(
      <MemoryRouter initialEntries={[`/artist/${artist.id}`]}>
        <Routes>
          <Route path="/artist/:id" element={<ArtistProfilePage />} />
        </Routes>
      </MemoryRouter>,
    )

    const onTour = await screen.findByRole('heading', { name: 'On tour' })
    const about = screen.getByRole('heading', { name: 'About' })
    expect(onTour.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Merch' })).not.toBeInTheDocument()

    const card = screen.getByRole('button', { name: `Open ${artist.name} biography` })
    expect(card).toHaveClass('aspect-[16/9]', 'max-w-4xl', 'overflow-hidden')
    expect(card).toHaveStyle({ color: '#ffffff' })
    expect(card.querySelector('img')).toHaveAttribute('src', artist.headerImageUrl)
    expect(card).toHaveTextContent('12.3M monthly listeners')
    expect(card).toHaveTextContent(artist.bio)
    expect(screen.getByTestId('artist-about-bio')).toHaveStyle({
      color: 'rgba(255,255,255,0.96)',
      WebkitLineClamp: '3',
      overflow: 'hidden',
    })
  })
})
