import React from 'react'
import { act } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountSettingsPage } from './AccountSettingsPage'
import { useAuthStore } from '@/stores/authStore'

const meServiceMock = vi.hoisted(() => ({
  exportData: vi.fn(() => Promise.resolve({ profile: {}, library: {} })),
  getDeletedPlaylists: vi.fn(() => Promise.resolve([{ id: 'deleted-1', originalPlaylistId: 'playlist-1', name: 'Deleted Mix', description: null, trackCount: 3, deletedAt: '2026-06-27T00:00:00Z', expiresAt: '2026-07-27T00:00:00Z' }])),
  restoreDeletedPlaylist: vi.fn(() => Promise.resolve({ id: 'restored-1' })),
  getLoginMethods: vi.fn(() => Promise.resolve({
    hasPassword: true,
    externalProviders: {
      google: { enabled: true, configured: true, available: true },
      facebook: { enabled: false, configured: false, available: false },
      apple: { enabled: false, configured: false, available: false },
    },
  })),
  getAccountPreferences: vi.fn(() => Promise.resolve({
    allowPersonalizedAds: true,
    blockAlcoholAds: false,
    blockGamblingAds: false,
    emailProductUpdates: true,
    emailSecurityAlerts: true,
  })),
  updateAccountPreferences: vi.fn((payload) => Promise.resolve(payload)),
  redeem: vi.fn(() => Promise.resolve({ code: 'NOTSPOTIFY30', message: 'Premium trial redeemed for 30 days.', user: null })),
  deleteAccount: vi.fn(() => Promise.resolve()),
}))

const billingServiceMock = vi.hoisted(() => ({
  getSubscription: vi.fn(),
  createPortalSession: vi.fn(),
  cancelSubscription: vi.fn(),
}))

const planServiceMock = vi.hoisted(() => ({
  getOverview: vi.fn(),
  invite: vi.fn(),
  acceptInvite: vi.fn(),
  declineInvite: vi.fn(),
  removeMember: vi.fn(),
}))

vi.mock('@/services/billingService', () => ({
  billingService: billingServiceMock,
}))

vi.mock('@/services/meService', () => ({
  meService: meServiceMock,
}))

vi.mock('@/services/planService', () => ({
  planService: planServiceMock,
}))

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(() => Promise.reject(new Error('no artist application'))),
    post: vi.fn(),
  },
}))

vi.mock('@/hooks/useConfirm', () => ({
  useConfirm: () => vi.fn(() => Promise.resolve(true)),
}))

const originalAuthState = useAuthStore.getState()

async function renderAccount() {
  const result = render(
    <MemoryRouter>
      <AccountSettingsPage />
    </MemoryRouter>,
  )
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  await screen.findByText('Become an artist')
  return result
}

async function clickAndFlush(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element)
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('AccountSettingsPage account feature rows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    billingServiceMock.getSubscription.mockResolvedValue({ plan: 'free', tier: 'individual', status: 'active', interval: null, currentPeriodEnd: null, cancelAtPeriodEnd: false })
    planServiceMock.getOverview.mockResolvedValue(null)
    act(() => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: {
          id: 'user-1',
          name: 'Test User',
          avatarUrl: null,
          plan: 'free',
          roles: [],
          capabilities: { unlimitedPlayback: false },
        } as never,
      })
    })
  })

  afterEach(() => {
    act(() => {
      useAuthStore.setState(originalAuthState, true)
    })
  })

  it('enables formerly greyed account rows and opens their functional panels', async () => {
    await renderAccount()

    await clickAndFlush(screen.getByRole('button', { name: /Recover playlists/ }))
    expect(await screen.findByText('Deleted Mix')).toBeInTheDocument()
    await clickAndFlush(screen.getByRole('button', { name: 'Close' }))

    await clickAndFlush(screen.getByRole('button', { name: /Redeem/ }))
    expect(screen.getByPlaceholderText('NOTSPOTIFY30')).toBeInTheDocument()
    await clickAndFlush(screen.getByRole('button', { name: 'Close' }))

    await clickAndFlush(screen.getByRole('button', { name: /Manage apps/ }))
    expect(await screen.findByText('Password sign-in is enabled.')).toBeInTheDocument()
    expect(screen.getByText('Google')).toBeInTheDocument()
    await clickAndFlush(screen.getByRole('button', { name: 'Close' }))

    await clickAndFlush(screen.getByRole('button', { name: /Ad preferences/ }))
    expect(await screen.findByText('Allow personalized ads')).toBeInTheDocument()
    await clickAndFlush(screen.getByRole('button', { name: 'Close' }))

    await clickAndFlush(screen.getByRole('button', { name: /Delete account/ }))
    expect(screen.getByPlaceholderText('Type DELETE')).toBeInTheDocument()
  })

  it('routes account rows that already have implemented destinations', async () => {
    await renderAccount()

    expect(screen.getByRole('link', { name: /Notification settings/ })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: /Account privacy/ })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: /Spotify support/ })).toHaveAttribute('href', '/support')
  })

  it('opens member management for Family plans', async () => {
    billingServiceMock.getSubscription.mockResolvedValue({ plan: 'premium', tier: 'family', status: 'active', interval: 'monthly', currentPeriodEnd: null, cancelAtPeriodEnd: false })
    planServiceMock.getOverview.mockResolvedValue({
      tier: 'family',
      maxMembers: 6,
      isOwner: true,
      isMember: false,
      planOwner: null,
      mySeatId: null,
      seatsUsed: 1,
      seatsTotal: 6,
      members: [],
      incomingInvites: [],
    })
    act(() => {
      useAuthStore.setState({ user: { ...useAuthStore.getState().user!, plan: 'premium' } })
    })

    await renderAccount()

    const manage = await screen.findByRole('button', { name: /Manage members/ })
    const membersHeading = await screen.findByText('Plan members')
    const membersPanel = document.getElementById('plan-members-card')!
    expect(manage).toHaveAttribute('aria-expanded', 'false')
    expect(membersPanel).toHaveClass('hidden')

    await clickAndFlush(manage)

    expect(manage).toHaveAttribute('aria-expanded', 'true')
    expect(membersPanel).not.toHaveClass('hidden')
    expect(membersHeading).toBeVisible()
    expect(screen.getByPlaceholderText('Invite by email…')).toBeVisible()
  })

  it('hides member management for Individual plans', async () => {
    billingServiceMock.getSubscription.mockResolvedValue({ plan: 'premium', tier: 'individual', status: 'active', interval: 'monthly', currentPeriodEnd: null, cancelAtPeriodEnd: false })
    act(() => {
      useAuthStore.setState({ user: { ...useAuthStore.getState().user!, plan: 'premium' } })
    })

    await renderAccount()

    expect(screen.queryByRole('button', { name: /Manage members/ })).not.toBeInTheDocument()
  })

  it('persists ad preference edits and redeem submissions', async () => {
    await renderAccount()

    await clickAndFlush(screen.getByRole('button', { name: /Ad preferences/ }))
    const alcohol = await screen.findByLabelText(/Reduce alcohol ads/)
    await clickAndFlush(alcohol)
    await clickAndFlush(screen.getByRole('button', { name: 'Save preferences' }))
    await waitFor(() => expect(meServiceMock.updateAccountPreferences).toHaveBeenCalledWith(expect.objectContaining({ blockAlcoholAds: true })))

    await clickAndFlush(screen.getByRole('button', { name: 'Close' }))
    await clickAndFlush(screen.getByRole('button', { name: /Redeem/ }))
    fireEvent.change(screen.getByPlaceholderText('NOTSPOTIFY30'), { target: { value: 'NOTSPOTIFY30' } })
    await clickAndFlush(screen.getByRole('button', { name: 'Redeem' }))
    await waitFor(() => expect(meServiceMock.redeem).toHaveBeenCalledWith('NOTSPOTIFY30'))
  })

  it('shows the one-time redemption error returned by the API', async () => {
    meServiceMock.redeem.mockRejectedValueOnce({
      response: { data: { message: 'This promo code has already been used.' } },
    })
    await renderAccount()

    await clickAndFlush(screen.getByRole('button', { name: /Redeem/ }))
    fireEvent.change(screen.getByPlaceholderText('NOTSPOTIFY30'), { target: { value: 'NOTSPOTIFY30' } })
    await clickAndFlush(screen.getByRole('button', { name: 'Redeem' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This promo code has already been used.')
  })
})
