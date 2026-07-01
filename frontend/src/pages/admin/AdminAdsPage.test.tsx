import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdAdmin } from '@/types/ad'
import { AdminAdsPage } from './AdminAdsPage'

// Mock the ad admin service so no real HTTP happens.
const list = vi.fn()
const create = vi.fn()
const update = vi.fn()
const remove = vi.fn()
const getSettings = vi.fn()
const updateSettings = vi.fn()

vi.mock('@/services/adService', () => ({
  adminAdService: {
    list: (...a: unknown[]) => list(...a),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    remove: (...a: unknown[]) => remove(...a),
    getSettings: (...a: unknown[]) => getSettings(...a),
    updateSettings: (...a: unknown[]) => updateSettings(...a),
  },
}))

// useConfirm returns an async confirm() — auto-confirm in tests.
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => () => Promise.resolve(true) }))
vi.mock('@/utils/toast', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

function makeAd(over: Partial<AdAdmin> = {}): AdAdmin {
  return {
    id: 'ad-1',
    title: 'Existing spot',
    advertiser: 'ACME',
    audioUrl: 'https://cdn/ad.mp3',
    imageUrl: null,
    clickUrl: null,
    durationMs: 30000,
    country: null,
    weight: 1,
    isActive: true,
    startsAt: null,
    endsAt: null,
    impressionCount: 12,
    createdAt: new Date().toISOString(),
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([])
  getSettings.mockResolvedValue({ adsPerNTracks: 3, isEnabled: true })
})

describe('AdminAdsPage', () => {
  it('lists ads returned by the service', async () => {
    list.mockResolvedValue([makeAd({ title: 'Summer sale' })])
    render(<AdminAdsPage />)

    expect(await screen.findByText('Summer sale')).toBeInTheDocument()
  })

  it('submits the form and renders the created ad in the list', async () => {
    create.mockResolvedValue(makeAd({ id: 'new', title: 'Fresh ad', advertiser: 'BrandX' }))
    render(<AdminAdsPage />)

    // Wait for initial load (empty list).
    expect(await screen.findByText('No advertisements yet.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'New ad' }))

    const form = screen.getByRole('form', { name: 'New advertisement' })
    fireEvent.change(within(form).getByLabelText('Title *'), { target: { value: 'Fresh ad' } })
    fireEvent.change(within(form).getByLabelText('Audio URL *'), { target: { value: 'https://cdn/fresh.mp3' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Create ad' }))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Fresh ad', audioUrl: 'https://cdn/fresh.mp3' }),
    )

    // The created ad shows up in the list table.
    expect(await screen.findByText('Fresh ad')).toBeInTheDocument()
  })

  it('blocks submit and shows an error when required fields are missing', async () => {
    render(<AdminAdsPage />)
    await screen.findByText('No advertisements yet.')

    fireEvent.click(screen.getByRole('button', { name: 'New ad' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create ad' }))

    expect(await screen.findByText('Title is required.')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('filters ads by title or advertiser, case-insensitively, and shows a no-results state', async () => {
    list.mockResolvedValue([
      makeAd({ id: 'ad-1', title: 'Summer sale', advertiser: 'ACME' }),
      makeAd({ id: 'ad-2', title: 'Winter promo', advertiser: 'BrandX' }),
    ])
    render(<AdminAdsPage />)

    expect(await screen.findByText('Summer sale')).toBeInTheDocument()
    expect(screen.getByText('Winter promo')).toBeInTheDocument()

    const search = screen.getByLabelText('Search advertisements')
    fireEvent.change(search, { target: { value: 'SUMMER' } })

    await waitFor(() => expect(screen.queryByText('Winter promo')).not.toBeInTheDocument())
    expect(screen.getByText('Summer sale')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'brandx' } })
    await waitFor(() => expect(screen.getByText('Winter promo')).toBeInTheDocument())
    expect(screen.queryByText('Summer sale')).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'nonexistent' } })
    expect(await screen.findByText('No results found.')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: '' } })
    await waitFor(() => expect(screen.getByText('Summer sale')).toBeInTheDocument())
    expect(screen.getByText('Winter promo')).toBeInTheDocument()
  })

  it('saves the global serving settings', async () => {
    updateSettings.mockResolvedValue({ adsPerNTracks: 5, isEnabled: false })
    render(<AdminAdsPage />)

    const cadence = await screen.findByLabelText('Ads per N tracks')
    fireEvent.change(cadence, { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1))
    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ adsPerNTracks: 5 }))
  })
})
