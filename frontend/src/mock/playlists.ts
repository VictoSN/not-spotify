import type { Playlist } from '@/types/playlist'
import { mockTracks } from './tracks'
import { mockUserRef } from './users'

const now = new Date().toISOString()

export const mockPlaylists: Playlist[] = [
  {
    id: 'playlist-1',
    name: 'Evening Chill',
    description: 'Wind down with ambient and dream-pop favourites.',
    coverUrl: 'https://picsum.photos/seed/pl1/300/300',
    isPublic: true,
    owner: mockUserRef,
    tracks: [
      { track: mockTracks[0], addedAt: now, addedBy: mockUserRef },
      { track: mockTracks[1], addedAt: now, addedBy: mockUserRef },
      { track: mockTracks[6], addedAt: now, addedBy: mockUserRef },
      { track: mockTracks[7], addedAt: now, addedBy: mockUserRef },
      { track: mockTracks[10], addedAt: now, addedBy: mockUserRef },
    ],
    followerCount: 1_240,
    totalDurationMs: 224_000 + 198_000 + 187_000 + 203_000 + 248_000,
    createdAt: '2023-12-01T00:00:00Z',
    updatedAt: now,
  },
  {
    id: 'playlist-2',
    name: 'Night Drive',
    description: 'Synthwave and retrowave for late-night cruising.',
    coverUrl: 'https://picsum.photos/seed/pl2/300/300',
    isPublic: true,
    owner: mockUserRef,
    tracks: [
      { track: mockTracks[8], addedAt: now, addedBy: mockUserRef },
      { track: mockTracks[9], addedAt: now, addedBy: mockUserRef },
      { track: mockTracks[10], addedAt: now, addedBy: mockUserRef },
    ],
    followerCount: 4_870,
    totalDurationMs: 296_000 + 312_000 + 248_000,
    createdAt: '2023-09-15T00:00:00Z',
    updatedAt: now,
  },
  {
    id: 'playlist-3',
    name: 'R&B Vibes',
    description: 'The smoothest neo-soul and R&B cuts right now.',
    coverUrl: 'https://picsum.photos/seed/pl3/300/300',
    isPublic: true,
    owner: mockUserRef,
    tracks: [
      { track: mockTracks[4], addedAt: now, addedBy: mockUserRef },
      { track: mockTracks[5], addedAt: now, addedBy: mockUserRef },
      { track: mockTracks[11], addedAt: now, addedBy: mockUserRef },
    ],
    followerCount: 9_300,
    totalDurationMs: 214_000 + 232_000 + 219_000,
    createdAt: '2024-01-20T00:00:00Z',
    updatedAt: now,
  },
]
