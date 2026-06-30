import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { TopBar } from './TopBar'
import { useAuthStore } from '@/stores/authStore'
import { useLocaleStore } from '@/stores/localeStore'
import { usePlayerStore } from '@/stores/playerStore'
import type { User } from '@/types/user'

const premiumUser: User = {
  id: 'premium-user',
  name: 'Premium Listener',
  email: 'premium@example.com',
  avatarUrl: null,
  plan: 'premium',
  country: 'SG',
  createdAt: '2026-01-01T00:00:00Z',
  roles: ['User'],
  subscriptionStatus: 'active',
  subscriptionInterval: 'monthly',
  subscriptionCurrentPeriodEnd: null,
  subscriptionCancelAtPeriodEnd: false,
  capabilities: { unlimitedPlayback: true, customPlaylistPictures: true },
  artistId: null,
}

describe('TopBar navigation', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
    useLocaleStore.setState({ language: 'en' })
    usePlayerStore.setState({ isKaraokeOpen: true })
  })

  it('closes karaoke when the logo is clicked on the current home route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TopBar />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('link', { name: /not-spotify home/i }))

    expect(usePlayerStore.getState().isKaraokeOpen).toBe(false)
  })

  it('closes karaoke when the home button is clicked on the current home route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TopBar />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Home' }))

    expect(usePlayerStore.getState().isKaraokeOpen).toBe(false)
  })

  it('closes karaoke from primary browse navigation', () => {
    render(
      <MemoryRouter initialEntries={['/search']}>
        <TopBar />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Browse all' }))

    expect(usePlayerStore.getState().isKaraokeOpen).toBe(false)
  })

  it('shows Install App immediately before notifications for Premium users', () => {
    useAuthStore.setState({ user: premiumUser, isAuthenticated: true })

    render(
      <MemoryRouter initialEntries={['/']}>
        <TopBar />
      </MemoryRouter>,
    )

    const installLink = screen.getByRole('link', { name: 'Install App' })
    const notifications = screen.getByRole('button', { name: 'Notifications' })
    const controls = Array.from(document.querySelectorAll('a,button'))

    expect(installLink).toHaveAttribute('href', '/install-app')
    expect(installLink.querySelector('svg')).toBeInTheDocument()
    expect(controls.indexOf(installLink)).toBeLessThan(controls.indexOf(notifications))
  })
})
