import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminDashboardPage } from './AdminDashboardPage'
import type { AdminDashboardStats } from '@/services/adminService'

const getDashboardStats = vi.fn()

vi.mock('@/services/adminService', () => ({
  adminService: {
    getDashboardStats: (...args: unknown[]) => getDashboardStats(...args),
  },
}))

vi.mock('@/components/common/AreaChart', () => ({
  AreaChart: () => <div data-testid="area-chart" />,
}))

const stats = (overrides: Partial<AdminDashboardStats> = {}): AdminDashboardStats => ({
  totalVisits: 0,
  visitsToday: 0,
  activeListeners: 0,
  totalUsers: 0,
  premiumUsers: 0,
  totalTracks: 0,
  totalArtists: 0,
  totalAlbums: 0,
  pendingApplications: 0,
  pendingAlbums: 0,
  pendingTracks: 0,
  playsToday: 0,
  playsLast7Days: 0,
  visitsTrend: [],
  playsTrend: [],
  topTracks: [],
  activeTracks: [],
  recentVisits: [],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  getDashboardStats.mockResolvedValue(stats())
})

describe('AdminDashboardPage', () => {
  it('labels and displays 30-day and all-time play metrics for top music', async () => {
    getDashboardStats.mockResolvedValue(stats({
      topTracks: [
        {
          id: 'track-1',
          title: 'Recent hit',
          artistName: 'The Metrics',
          albumTitle: 'Dashboard Songs',
          coverUrl: null,
          playCount: 25,
          playsInWindow: 10,
          uniqueListeners: 4,
        },
      ],
    }))

    render(<AdminDashboardPage />)

    const topMusic = await screen.findByRole('heading', { name: 'Top music' })
    const panel = topMusic.closest('section') ?? topMusic.parentElement!.parentElement!

    expect(within(panel).getAllByText('Last 30 days').length).toBeGreaterThan(0)
    expect(within(panel).getAllByText('All time').length).toBeGreaterThan(0)
    expect(within(panel).getAllByText('Listeners').length).toBeGreaterThan(0)
    expect(within(panel).getAllByText('Trend').length).toBeGreaterThan(0)
    expect(within(panel).getByText('Recent hit')).toBeInTheDocument()
    expect(within(panel).getByText('The Metrics - Dashboard Songs')).toBeInTheDocument()
    expect(within(panel).getByText('10')).toBeInTheDocument()
    expect(within(panel).getByText('25')).toBeInTheDocument()
    expect(within(panel).getByText('4')).toBeInTheDocument()
    expect(within(panel).getByText('40%')).toBeInTheDocument()
  })
})
