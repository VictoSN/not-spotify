import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    const user = userEvent.setup()
    create.mockResolvedValue(makeAd({ id: 'new', title: 'Fresh ad', advertiser: 'BrandX' }))
    render(<AdminAdsPage />)

    // Wait for initial load (empty list).
    expect(await screen.findByText('No advertisements yet.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New ad' }))

    const form = screen.getByRole('form', { name: 'New advertisement' })
    await user.type(within(form).getByLabelText('Title *'), 'Fresh ad')
    await user.type(within(form).getByLabelText('Audio URL *'), 'https://cdn/fresh.mp3')
    await user.click(within(form).getByRole('button', { name: 'Create ad' }))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Fresh ad', audioUrl: 'https://cdn/fresh.mp3' }),
    )

    // The created ad shows up in the list table.
    expect(await screen.findByText('Fresh ad')).toBeInTheDocument()
  })

  it('blocks submit and shows an error when required fields are missing', async () => {
    const user = userEvent.setup()
    render(<AdminAdsPage />)
    await screen.findByText('No advertisements yet.')

    await user.click(screen.getByRole('button', { name: 'New ad' }))
    await user.click(screen.getByRole('button', { name: 'Create ad' }))

    expect(await screen.findByText('Title is required.')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('saves the global serving settings', async () => {
    const user = userEvent.setup()
    updateSettings.mockResolvedValue({ adsPerNTracks: 5, isEnabled: false })
    render(<AdminAdsPage />)

    const cadence = await screen.findByLabelText('Ads per N tracks')
    await user.clear(cadence)
    await user.type(cadence, '5')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1))
    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ adsPerNTracks: 5 }))
  })
})
