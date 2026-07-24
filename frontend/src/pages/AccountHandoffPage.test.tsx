import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountHandoffPage } from './AccountHandoffPage'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/user'

// The interstitial pulls in useDocumentTitle (harmless) and the auth store; no network.
const logoutMock = vi.fn().mockResolvedValue(undefined)

const userA: User = {
  id: 'account-a',
  name: 'Alex',
  email: 'alex@example.com',
  avatarUrl: null,
  plan: 'free',
  country: 'US',
  createdAt: '2026-01-01T00:00:00Z',
  roles: [],
  subscriptionStatus: null,
  subscriptionInterval: null,
  subscriptionCurrentPeriodEnd: null,
  subscriptionCancelAtPeriodEnd: false,
  capabilities: { unlimitedPlayback: false, customPlaylistPictures: false },
  artistId: null,
}

function setAuth(partial: Partial<ReturnType<typeof useAuthStore.getState>>) {
  useAuthStore.setState({
    isInitializing: false,
    isAuthenticated: false,
    user: null,
    logout: logoutMock as unknown as ReturnType<typeof useAuthStore.getState>['logout'],
    ...partial,
  })
}

/** Renders the handoff at a given URL and exposes the current location for assertions. */
function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/handoff" element={<AccountHandoffPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname + loc.search}</div>
}

describe('AccountHandoffPage', () => {
  beforeEach(() => {
    logoutMock.mockClear()
    setAuth({})
  })
  afterEach(() => {
    setAuth({ isInitializing: true })
  })

  it('continues straight to the destination when the account matches', async () => {
    setAuth({ isAuthenticated: true, user: { ...userA, id: 'account-b' } })
    renderAt('/handoff?acct=account-b&hint=b%E2%80%A2%E2%80%A2%40x.com&next=%2Faccount')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/account'))
  })

  it('shows the mismatch interstitial when the accounts differ', () => {
    setAuth({ isAuthenticated: true, user: userA }) // signed in as A
    renderAt('/handoff?acct=account-b&hint=b%E2%80%A2%E2%80%A2%40nugget.com&next=%2Faccount')

    expect(screen.getByRole('heading', { name: 'Choose an account' })).toBeInTheDocument()
    expect(screen.getByText(/b•+@nugget\.com/)).toBeInTheDocument() // opened-for (B)
    // A's masked email appears in both the message and the "Continue as" button.
    expect(screen.getAllByText(/a•+@example\.com/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Switch account' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue as/ })).toBeInTheDocument()
  })

  it('does NOT auto-navigate on a mismatch (loop-safe)', () => {
    setAuth({ isAuthenticated: true, user: userA })
    renderAt('/handoff?acct=account-b&hint=x&next=%2Faccount')
    // Still on the interstitial, not redirected.
    expect(screen.queryByTestId('location')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Choose an account' })).toBeInTheDocument()
  })

  it('sends an unauthenticated browser to login, preserving the handoff for a re-check', async () => {
    setAuth({ isAuthenticated: false, user: null })
    renderAt('/handoff?acct=account-b&hint=x&next=%2Faccount')
    await waitFor(() => {
      const loc = screen.getByTestId('location').textContent ?? ''
      expect(loc).toContain('/login')
      expect(loc).toContain('next=')
      expect(decodeURIComponent(loc)).toContain('/handoff') // returns here to re-check
    })
  })

  it('"Continue as A" navigates to the destination', async () => {
    setAuth({ isAuthenticated: true, user: userA })
    renderAt('/handoff?acct=account-b&hint=x&next=%2Fsupport')
    fireEvent.click(screen.getByRole('button', { name: /Continue as/ }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/support'))
  })

  it('"Switch account" logs out only the browser and routes to login', async () => {
    setAuth({ isAuthenticated: true, user: userA })
    renderAt('/handoff?acct=account-b&hint=x&next=%2Faccount')
    fireEvent.click(screen.getByRole('button', { name: 'Switch account' }))
    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledWith({ reload: false })
      expect(screen.getByTestId('location').textContent).toContain('/login')
    })
  })

  it('coerces a malicious next to the site root (no open redirect)', async () => {
    setAuth({ isAuthenticated: true, user: { ...userA, id: 'account-b' } })
    // matching account so it auto-continues — but next is an open-redirect attempt
    renderAt('/handoff?acct=account-b&next=%2F%2Fevil.com')
    await waitFor(() => {
      const loc = screen.getByTestId('location').textContent ?? ''
      expect(loc).toBe('/') // never /evil.com
      expect(loc).not.toContain('evil')
    })
  })

  it('cancel returns to the site root', async () => {
    setAuth({ isAuthenticated: true, user: userA })
    renderAt('/handoff?acct=account-b&hint=x&next=%2Faccount')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'))
  })
})
