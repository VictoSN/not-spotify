import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FamilyPlanPage } from './FamilyPlanPage'
import { useAuthStore } from '@/stores/authStore'

const billingMock = vi.hoisted(() => ({
  getPlans: vi.fn(),
  getSubscription: vi.fn(),
  createCheckoutSession: vi.fn(),
}))
const planMock = vi.hoisted(() => ({ getOverview: vi.fn() }))

vi.mock('@/services/billingService', () => ({ billingService: billingMock }))
vi.mock('@/services/planService', () => ({ planService: planMock }))
vi.mock('@/components/settings/PlanMembersCard', () => ({
  PlanMembersCard: () => <div data-testid="plan-members-card">Member controls</div>,
}))

describe('FamilyPlanPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'u1', name: 'Listener', email: 'listener@example.com', plan: 'free' } as never,
      isAuthenticated: true,
    })
    billingMock.getPlans.mockResolvedValue([{
      plan: 'family', tier: 'family', maxMembers: 6, interval: 'monthly', label: 'Premium Family',
      cardTitle: 'Family', priceId: 'price_family', isConfigured: true, discountLabel: null,
      perks: [], finePrint: 'Terms apply.', accentColor: '#1ed760', buttonColor: '#1ed760',
      buttonTextColor: '#000000', displayPrice: '$19.99 / month', missingConfiguration: null,
    }])
    billingMock.getSubscription.mockResolvedValue({
      plan: 'free', tier: 'individual', status: null, interval: null,
      currentPeriodEnd: null, cancelAtPeriodEnd: false,
    })
    planMock.getOverview.mockResolvedValue({
      tier: 'individual', maxMembers: 1, isOwner: false, isMember: false,
      planOwner: null, mySeatId: null, seatsUsed: 0, seatsTotal: 1,
      members: [], incomingInvites: [],
    })
  })

  it('offers the configured Family checkout and stable supporting routes', async () => {
    render(<MemoryRouter><FamilyPlanPage /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'Set up your Family plan' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Get Premium Family' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Back to Account' })).toHaveAttribute('href', '/account')
    expect(screen.getByRole('link', { name: 'Family plan help' })).toHaveAttribute('href', '/support?topic=premium-family')
  })

  it('shows member controls for an active Family owner', async () => {
    billingMock.getSubscription.mockResolvedValue({
      plan: 'premium', tier: 'family', status: 'active', interval: 'monthly',
      currentPeriodEnd: null, cancelAtPeriodEnd: false,
    })
    planMock.getOverview.mockResolvedValue({
      tier: 'family', maxMembers: 6, isOwner: true, isMember: false,
      planOwner: null, mySeatId: null, seatsUsed: 2, seatsTotal: 6,
      members: [], incomingInvites: [],
    })

    render(<MemoryRouter><FamilyPlanPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('Family plan active')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Manage your members' })).toBeInTheDocument()
    expect(screen.getByTestId('plan-members-card')).toBeInTheDocument()
  })
})
