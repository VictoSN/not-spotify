import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveEventsPage } from './LiveEventsPage'
import { useAuthStore } from '@/stores/authStore'
import type { LiveEvent } from '@/types/artist'

class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const getLiveEvents = vi.hoisted(() => vi.fn())
const getFollowing = vi.hoisted(() => vi.fn())
const getTopTracks = vi.hoisted(() => vi.fn())

vi.mock('@/services/artistService', () => ({
  artistService: { getLiveEvents, getFollowing, getTopTracks },
}))

const event = (overrides: Partial<LiveEvent> = {}): LiveEvent => ({
  id: 'event-1',
  eventDate: '2030-07-12T20:00:00Z',
  city: 'New York',
  venue: 'Webster Hall',
  country: 'US',
  ticketUrl: 'https://tickets.test/event-1',
  songs: [],
  artist: {
    id: 'artist-1',
    name: 'Nova Bloom',
    imageUrl: '/nova.jpg',
    headerImageUrl: null,
    monthlyListeners: 500_000,
    genres: ['pop'],
  },
  ...overrides,
})

const events: LiveEvent[] = [
  event(),
  event({
    id: 'event-2',
    city: 'London',
    country: 'GB',
    venue: 'Roundhouse',
    artist: { id: 'artist-2', name: 'Static Hearts', imageUrl: '/static.jpg', headerImageUrl: null, monthlyListeners: 250_000, genres: ['rock'] },
  }),
]

function renderPage() {
  return render(<MemoryRouter><LiveEventsPage /></MemoryRouter>)
}

describe('LiveEventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useAuthStore.setState({ isAuthenticated: false, user: null })
    getLiveEvents.mockResolvedValue(events)
    getFollowing.mockResolvedValue([])
    getTopTracks.mockResolvedValue([])
  })

  it('loads the worldwide feed and links cards to existing event details', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Live Events' })).toBeInTheDocument()
    await waitFor(() => expect(getLiveEvents).toHaveBeenCalledWith('all', 200))
    expect(screen.getByRole('heading', { name: 'Just for you' })).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: /Nova Bloom/ })
    expect(links.some((link) => link.getAttribute('href') === '/artist/artist-1/events/event-1')).toBe(true)
  })

  it('prompts for a location, then filters the feed by the chosen city and genre', async () => {
    renderPage()
    await screen.findAllByText('Nova Bloom')

    // No location picked yet → the set-your-location prompt shows above the feed.
    expect(screen.getByRole('heading', { name: 'Set your location' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Choose location' }))
    fireEvent.click(await screen.findByRole('option', { name: /London, GB/ }))

    expect(screen.queryByRole('heading', { name: 'Set your location' })).not.toBeInTheDocument()
    expect(screen.queryAllByText('Nova Bloom')).toHaveLength(0)
    expect(screen.getAllByText('Static Hearts').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Popular in London' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filter events by genre'), { target: { value: 'pop' } })
    expect(screen.getByRole('heading', { name: 'Nothing in London, GB yet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show all events' })).toBeInTheDocument()
  })

  it('remembers the stored location across visits', async () => {
    localStorage.setItem('not-spotify:live-events-location', 'London, GB')
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Popular in London' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Set your location' })).not.toBeInTheDocument()
    expect(screen.queryAllByText('Nova Bloom')).toHaveLength(0)
  })

  it('renders a useful empty state when the feed has no events', async () => {
    getLiveEvents.mockResolvedValue([])
    renderPage()

    expect(await screen.findByRole('heading', { name: 'No upcoming events yet' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Set your location' })).not.toBeInTheDocument()
  })
})
