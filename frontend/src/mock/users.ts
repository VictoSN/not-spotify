import type { User, UserRef } from '@/types/user'

export const mockUser: User = {
  id: 'user-1',
  name: 'Alex Rivera',
  email: 'alex@example.com',
  avatarUrl: 'https://picsum.photos/seed/user1/100/100',
  plan: 'premium',
  country: 'US',
  createdAt: '2022-01-10T00:00:00Z',
  roles: ['Admin'],
  subscriptionStatus: 'active',
  subscriptionInterval: 'yearly',
  subscriptionCurrentPeriodEnd: null,
  subscriptionCancelAtPeriodEnd: false,
  capabilities: {
    unlimitedPlayback: true,
    customPlaylistPictures: true,
  },
  artistId: null,
}

export const mockUserRef: UserRef = {
  id: mockUser.id,
  name: mockUser.name,
  avatarUrl: mockUser.avatarUrl,
}
