import { describe, expect, it } from 'vitest'
import type { BillingSubscription } from '@/services/billingService'
import { planTypeLabel } from './PremiumPage'

function subscription(
  tier: BillingSubscription['tier'],
  interval: BillingSubscription['interval'] = 'monthly',
): BillingSubscription {
  return {
    plan: 'premium',
    tier,
    status: 'active',
    interval,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  }
}

describe('Premium current plan label', () => {
  it('uses the product name for monthly and yearly individual plans', () => {
    expect(planTypeLabel(true, null, subscription('individual'), null)).toBe('Premium Individual')
    expect(planTypeLabel(true, null, subscription('individual', 'yearly'), null)).toBe('Premium Individual Yearly')
  })

  it('uses the stored subscription tier for Duo, Family, and Student', () => {
    expect(planTypeLabel(true, null, subscription('duo'), null)).toBe('Premium Duo')
    expect(planTypeLabel(true, null, subscription('family'), null)).toBe('Premium Family')
    expect(planTypeLabel(true, null, subscription('student'), null)).toBe('Premium Student')
  })

  it('shows the free-plan label for users without Premium', () => {
    expect(planTypeLabel(false, null, null, null)).toBe('Free plan')
  })
})
