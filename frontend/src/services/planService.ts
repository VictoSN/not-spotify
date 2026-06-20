import { api } from './api'

export interface PlanMember {
  id: string
  status: 'invited' | 'active'
  email: string
  member: { id: string; name: string; imageUrl: string | null } | null
}

export interface PlanInvite {
  id: string
  owner: { id: string; name: string; imageUrl: string | null }
  tier: string
}

export interface PlanOverview {
  tier: string
  maxMembers: number
  isOwner: boolean
  isMember: boolean
  planOwner: { id: string; name: string; imageUrl: string | null } | null
  mySeatId: string | null
  seatsUsed: number
  seatsTotal: number
  members: PlanMember[]
  incomingInvites: PlanInvite[]
}

export const planService = {
  async getOverview(): Promise<PlanOverview> {
    const res = await api.get<PlanOverview>('/me/plan')
    return res.data
  },

  async invite(email: string): Promise<PlanOverview> {
    const res = await api.post<PlanOverview>('/me/plan/invite', { email })
    return res.data
  },

  async acceptInvite(id: string): Promise<PlanOverview> {
    const res = await api.post<PlanOverview>(`/me/plan/invites/${id}/accept`)
    return res.data
  },

  async declineInvite(id: string): Promise<void> {
    await api.post(`/me/plan/invites/${id}/decline`)
  },

  async removeMember(id: string): Promise<void> {
    await api.delete(`/me/plan/members/${id}`)
  },
}
