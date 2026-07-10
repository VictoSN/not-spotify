import { api } from './api'

export type PlanKey = string
export type PlanTier = 'individual' | 'duo' | 'family' | 'student'

export interface BillingPlan {
  plan: PlanKey
  tier: PlanTier
  maxMembers: number
  interval: 'monthly' | 'yearly'
  label: string
  cardTitle: string
  priceId: string
  isConfigured: boolean
  discountLabel: string | null
  perks: string[]
  finePrint: string
  accentColor: string
  buttonColor: string
  buttonTextColor: string
  displayPrice: string | null
  missingConfiguration: string | null
}

export interface BillingSubscription {
  plan: 'free' | 'premium'
  tier: 'individual' | 'duo' | 'family' | 'student'
  status: string | null
  interval: 'monthly' | 'yearly' | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export const billingService = {
  async getPlans(): Promise<BillingPlan[]> {
    const res = await api.get<BillingPlan[]>('/billing/plans')
    return res.data
  },

  async getSubscription(): Promise<BillingSubscription> {
    const res = await api.get<BillingSubscription>('/billing/subscription')
    return res.data
  },

  // Reconciles the plan directly from Stripe (used on the checkout-success
  // redirect so Premium activates without waiting on the webhook).
  async syncSubscription(): Promise<BillingSubscription> {
    const res = await api.post<BillingSubscription>('/billing/sync')
    return res.data
  },

  async createCheckoutSession(plan: PlanKey): Promise<string> {
    const res = await api.post<{ url: string }>('/billing/checkout-session', { plan })
    return res.data.url
  },

  async createPortalSession(): Promise<string> {
    const res = await api.post<{ url: string }>('/billing/portal-session')
    return res.data.url
  },

  async cancelSubscription(): Promise<void> {
    await api.delete('/billing/subscription')
  },
}
