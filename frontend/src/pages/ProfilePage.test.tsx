import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { ProfilePage } from './ProfilePage'
import { FollowingPage } from './FollowingPage'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const friendMocks = vi.hoisted(() => ({
  getFollowers: vi.fn(),
  getFollowing: vi.fn(),
  follow: vi.fn(),
  unfollow: vi.fn(),
}))
const writeTextMock = vi.fn()

vi.mock('@/services/friendService', () => ({ friendService: friendMocks }))

vi.mock('@/hooks/useDominantColor', () => ({
  useDominantColor: () => null,
  profileGradient: () => 'none',
}))

const artist = {
  id: 'artist-1',
  name: 'Moonlight Artist',
  bio: null,
  imageUrl: null,
  headerImageUrl: null,
  monthlyListeners: 1_000,
  genres: ['pop'],
  followerCount: 25,
  verified: true,
  socialLinks: {},
  createdAt: '2026-01-01T00:00:00Z',
}

const originalAuthState = useAuthStore.getState()
const originalLibraryState = useLibraryStore.getState()

describe('profile following controls', () => {
  beforeEach(() => {
    writeTextMock.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    })
    friendMocks.getFollowers.mockResolvedValue([
      { id: 'follower-1', name: 'Follower One', avatarUrl: null, isArtist: false, isFollowedByMe: false },
    ])
    friendMocks.getFollowing.mockResolvedValue([
      { id: 'artist-user-1', name: 'Moonlight Artist', avatarUrl: null, isArtist: true, artistId: 'artist-1', isFollowedByMe: true },
      { id: 'profile-1', name: 'Profile One', avatarUrl: null, isArtist: false, isFollowedByMe: true },
      { id: 'profile-2', name: 'Profile Two', avatarUrl: null, isArtist: false, isFollowedByMe: true },
    ])
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'me', name: 'Doreen', avatarUrl: null } as never,
    })
    useLibraryStore.setState({
      followedArtists: [artist],
      likedSongs: [],
      savedPlaylists: [],
      isLoading: false,
      fetchLibrary: vi.fn().mockResolvedValue(undefined),
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  afterAll(() => {
    useAuthStore.setState(originalAuthState, true)
    useLibraryStore.setState(originalLibraryState, true)
  })

  it('opens profile editing from the account name and exposes actions under the three-dot menu', async () => {
    render(<MemoryRouter initialEntries={['/profile']}><ProfilePage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('1 Followers')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: '3 Following' })).toHaveAttribute('href', '/following')
    expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Doreen profile' }))
    expect(screen.getByRole('dialog', { name: 'Profile details' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    fireEvent.click(screen.getByRole('button', { name: 'More profile options' }))
    expect(await screen.findByRole('menuitem', { name: 'Edit profile' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy link to profile' }))
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(`${window.location.origin}/user/me`)
    })
  })

  it('combines followed artists and profiles and filters each category', async () => {
    render(<MemoryRouter initialEntries={['/following']}><FollowingPage /></MemoryRouter>)

    expect(await screen.findByText('Moonlight Artist')).toBeInTheDocument()
    expect(screen.getAllByText('Moonlight Artist')).toHaveLength(1)
    expect(screen.getByText('Profile One')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Profiles' }))
    expect(screen.queryByText('Moonlight Artist')).not.toBeInTheDocument()
    expect(screen.getByText('Profile One')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Artists' }))
    expect(screen.getByText('Moonlight Artist')).toBeInTheDocument()
    expect(screen.queryByText('Profile One')).not.toBeInTheDocument()
  })
})
