import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsShell } from './SettingsShell'
import { useAuthStore } from '@/stores/authStore'

// Keep the desktop layout so the mobile-only player/nav aren't rendered.
vi.mock('@/hooks/useMediaQuery', () => ({ useIsMobile: () => false }))

function renderShell(route: string, roles: string[] = []) {
  useAuthStore.setState({
    isAuthenticated: true,
    user: { id: 'u1', name: 'Test', avatarUrl: null, plan: 'free', roles } as never,
  })
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<SettingsShell />}>
          <Route path="/account" element={<div>account body</div>} />
          <Route path="/artist-dashboard" element={<div>dashboard body</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  // The avatar/name button toggles the dropdown.
  fireEvent.click(screen.getByRole('button'))
}

describe('SettingsShell context-aware account menu (bug 14)', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false })
  })

  it('uses Not Spotify branding in the header', () => {
    renderShell('/account')

    expect(screen.getByRole('link', { name: 'Not Spotify home' })).toHaveAttribute('href', '/')
    expect(screen.getByText('Not Spotify')).toBeInTheDocument()
    expect(screen.queryByText('Spotify')).not.toBeInTheDocument()
  })

  it('hides "Account" and shows "Artist Dashboard" on the Account page', () => {
    renderShell('/account', ['Artist'])

    expect(screen.queryByRole('link', { name: 'Account' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile')
    expect(screen.getByRole('link', { name: 'Artist Dashboard' })).toHaveAttribute('href', '/artist-dashboard')
  })

  it('hides "Artist Dashboard" and shows "Account" on the Artist Dashboard', () => {
    renderShell('/artist-dashboard', ['Artist'])

    expect(screen.queryByRole('link', { name: 'Artist Dashboard' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument()
  })

  it('shows neither Account nor Artist Dashboard for non-artists on the Account page', () => {
    renderShell('/account', [])

    expect(screen.queryByRole('link', { name: 'Account' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Artist Dashboard' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument()
  })
})
