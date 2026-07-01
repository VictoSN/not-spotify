import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ForgotPasswordPage } from './ForgotPasswordPage'

// Unit test: no network. Mock the one service the page talks to.
const authServiceMock = vi.hoisted(() => ({ forgotPassword: vi.fn() }))
vi.mock('@/services/authService', () => ({ authService: authServiceMock }))

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname + loc.search}</div>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<LocationProbe />} />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ForgotPasswordPage (bug #16)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the same bg-page theme as the login/register pages (not the old bg-base)', () => {
    const { container } = renderPage()
    expect(container.querySelector('.bg-page')).toBeTruthy()
    expect(container.querySelector('.bg-base')).toBeFalsy()
  })

  it('emails a reset code and shows the check-your-email confirmation without leaking a code in production', async () => {
    authServiceMock.forgotPassword.mockResolvedValue({
      message: "If an account exists for that email, we've sent a 6-digit code to reset your password.",
      developmentCode: null,
      resetUrl: null,
    })
    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset code' }))

    await waitFor(() => expect(authServiceMock.forgotPassword).toHaveBeenCalledWith('user@example.com'))
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    // Production response carries no code — nothing sensitive is rendered.
    expect(screen.queryByText('Development code')).toBeNull()
  })

  it('shows the development code and carries email + code to the reset page', async () => {
    authServiceMock.forgotPassword.mockResolvedValue({ message: 'ok', developmentCode: '123456', resetUrl: null })
    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'User@Example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset code' }))

    expect(await screen.findByText('123456')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Enter reset code' }))
    expect(screen.getByTestId('location').textContent).toBe('/reset-password?email=User%40Example.com&code=123456')
  })

  it('still lands on the generic confirmation when the request fails (anti-enumeration)', async () => {
    authServiceMock.forgotPassword.mockRejectedValue(new Error('boom'))
    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ghost@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset code' }))

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
  })
})
