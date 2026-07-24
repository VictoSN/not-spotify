import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { openUrl } from '@tauri-apps/plugin-opener'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TopBar } from './TopBar'
import { useAuthStore } from '@/stores/authStore'
import { useLocaleStore } from '@/stores/localeStore'
import { usePlayerStore } from '@/stores/playerStore'
import type { User } from '@/types/user'

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}))

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
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
    Reflect.deleteProperty(window, '__TAURI__')
    vi.mocked(openUrl).mockClear()
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

  it('routes standalone account destinations without leaving the signed-in app origin', () => {
    useAuthStore.setState({ user: premiumUser, isAuthenticated: true })

    render(
      <MemoryRouter initialEntries={['/']}>
        <TopBar />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'User menu' }))

    const destinations = [
      [screen.getByRole('link', { name: 'Account' }), '/account'],
      [screen.getByRole('link', { name: 'Set up your Family plan' }), '/account/family'],
      [screen.getByRole('link', { name: 'Support' }), '/support'],
      [screen.getByRole('link', { name: 'Download' }), '/download/windows'],
    ] as const

    for (const [link, href] of destinations) {
      expect(link).toHaveAttribute('href', href)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  it('opens desktop account destinations in the system browser', () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })
    useAuthStore.setState({ user: premiumUser, isAuthenticated: true })

    render(
      <MemoryRouter initialEntries={['/']}>
        <TopBar />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'User menu' }))

    const account = screen.getByRole('link', { name: 'Account' })
    const family = screen.getByRole('link', { name: 'Set up your Family plan' })
    const support = screen.getByRole('link', { name: 'Support' })
    const download = screen.getByRole('link', { name: 'Download' })

    expect(account).toHaveAttribute(
      'href',
      'https://account.not-spotify.lol/handoff?acct=premium-user&hint=p%E2%80%A2%E2%80%A2%E2%80%A2%E2%80%A2%40example.com&next=%2Faccount#email=premium%40example.com',
    )
    expect(family).toHaveAttribute(
      'href',
      'https://account.not-spotify.lol/handoff?acct=premium-user&hint=p%E2%80%A2%E2%80%A2%E2%80%A2%E2%80%A2%40example.com&next=%2Faccount%2Ffamily#email=premium%40example.com',
    )
    expect(support).toHaveAttribute(
      'href',
      'https://support.not-spotify.lol/handoff?acct=premium-user&hint=p%E2%80%A2%E2%80%A2%E2%80%A2%E2%80%A2%40example.com&next=%2Fsupport#email=premium%40example.com',
    )
    expect(download).toHaveAttribute(
      'href',
      'https://download.not-spotify.lol/handoff?acct=premium-user&hint=p%E2%80%A2%E2%80%A2%E2%80%A2%E2%80%A2%40example.com&next=%2Fdownload%2Fwindows#email=premium%40example.com',
    )

    fireEvent.click(account)

    expect(openUrl).toHaveBeenCalledOnce()
    expect(openUrl).toHaveBeenCalledWith(account.getAttribute('href'))
  })
})
