import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '@/types/track'
import { AdminTracksListPage } from './AdminTracksListPage'

const listTracks = vi.fn()
const listPendingTracks = vi.fn()

vi.mock('@/services/adminService', () => ({
  adminService: {
    listTracks: (...a: unknown[]) => listTracks(...a),
    listPendingTracks: (...a: unknown[]) => listPendingTracks(...a),
    getTrackReviewHistory: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('@/services/trackService', () => ({ trackService: { download: vi.fn() } }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => () => Promise.resolve(true) }))
vi.mock('@/utils/toast', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

function makeTrack(over: Partial<Track> = {}): Track {
  return {
    id: 't-1',
    title: 'Sunny Days',
    durationMs: 200000,
    audioUrl: 'https://cdn/t.mp3',
    previewUrl: null,
    trackNumber: 1,
    discNumber: 1,
    explicit: false,
    playCount: 0,
    ratingCount: 0,
    averageRating: 0,
    artist: { id: 'a-1', name: 'Jane Doe', imageUrl: null },
    album: { id: 'al-1', title: 'First Light', coverUrl: '', releaseDate: '2024-01-01', type: 'album' },
    genres: [],
    createdAt: new Date().toISOString(),
    status: 'approved',
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listPendingTracks.mockResolvedValue([])
  listTracks.mockResolvedValue([])
})

describe('AdminTracksListPage search', () => {
  it('filters tracks by title, artist, or album — case-insensitively — and shows a no-results state', async () => {
    listTracks.mockResolvedValue([
      makeTrack({ id: 't-1', title: 'Sunny Days', artist: { id: 'a-1', name: 'Jane Doe', imageUrl: null }, album: { id: 'al-1', title: 'First Light', coverUrl: '', releaseDate: '2024-01-01', type: 'album' } }),
      makeTrack({ id: 't-2', title: 'Midnight Drive', artist: { id: 'a-2', name: 'Big Band', imageUrl: null }, album: { id: 'al-2', title: 'Night Owl', coverUrl: '', releaseDate: '2024-02-01', type: 'album' } }),
    ])
    render(<AdminTracksListPage />)

    expect(await screen.findByText('Sunny Days')).toBeInTheDocument()
    expect(screen.getByText('Midnight Drive')).toBeInTheDocument()

    const search = screen.getByLabelText('Search tracks')

    fireEvent.change(search, { target: { value: 'SUNNY' } })
    await waitFor(() => expect(screen.queryByText('Midnight Drive')).not.toBeInTheDocument())
    expect(screen.getByText('Sunny Days')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'big band' } })
    await waitFor(() => expect(screen.getByText('Midnight Drive')).toBeInTheDocument())
    expect(screen.queryByText('Sunny Days')).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'night owl' } })
    await waitFor(() => expect(screen.getByText('Midnight Drive')).toBeInTheDocument())
    expect(screen.queryByText('Sunny Days')).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'nope-nothing-matches' } })
    expect(await screen.findByText('No results found.')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: '' } })
    await waitFor(() => expect(screen.getByText('Sunny Days')).toBeInTheDocument())
    expect(screen.getByText('Midnight Drive')).toBeInTheDocument()
  })
})
