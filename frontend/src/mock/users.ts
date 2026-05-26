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
}

export const mockUserRef: UserRef = {
  id: mockUser.id,
  name: mockUser.name,
  avatarUrl: mockUser.avatarUrl,
}
