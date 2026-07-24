import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'
import { useAuthStore } from '@/stores/authStore'

vi.mock('@/services/authService', () => ({
  authService: {
    captchaConfig: vi.fn().mockResolvedValue({ enabled: false, siteKey: null }),
    externalProviders: vi.fn().mockResolvedValue({
      google: { available: false },
      facebook: { available: false },
    }),
  },
}))

const authenticatedUser = (roles: string[]) => ({
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  roles,
})

function renderLogin(initialEntry = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>music home</div>} />
        <Route path="/admin/dashboard" element={<div>admin dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage post-login routing', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      isInitializing: false,
      error: null,
    })
  })

  it('routes an admin to the admin dashboard', async () => {
    useAuthStore.setState({ user: authenticatedUser(['Admin']) as never, isAuthenticated: true })

    renderLogin()

    expect(await screen.findByText('admin dashboard')).toBeInTheDocument()
  })

  it('continues to route a listener to the music home page', async () => {
    useAuthStore.setState({ user: authenticatedUser(['User']) as never, isAuthenticated: true })

    renderLogin()

    expect(await screen.findByText('music home')).toBeInTheDocument()
  })

  it('prefills only the email from an account handoff fragment', () => {
    renderLogin('/login?next=%2Fhandoff%3Facct%3Daccount-b#email=bob%40example.com')

    expect(screen.getByRole('textbox')).toHaveValue('bob@example.com')
    expect(document.querySelector('input[type="password"]')).toHaveValue('')
  })
})
