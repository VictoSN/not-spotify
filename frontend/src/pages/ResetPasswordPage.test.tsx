import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResetPasswordPage } from './ResetPasswordPage'

const authServiceMock = vi.hoisted(() => ({ resetPassword: vi.fn() }))
vi.mock('@/services/authService', () => ({ authService: authServiceMock }))
vi.mock('@/utils/toast', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

function renderReset(search = '?email=user@example.com&code=123456') {
  return render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/forgot-password" element={<div>forgot page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResetPasswordPage (bug #16)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the bg-page theme and prefills email + code from the URL', () => {
    const { container } = renderReset()
    expect(container.querySelector('.bg-page')).toBeTruthy()
    expect(container.querySelector('.bg-base')).toBeFalsy()
    expect(screen.getByLabelText('Email')).toHaveValue('user@example.com')
    expect(screen.getByLabelText('6-digit reset code')).toHaveValue('123456')
  })

  it('blocks mismatched passwords and never calls the API', () => {
    renderReset()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'password2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    expect(authServiceMock.resetPassword).not.toHaveBeenCalled()
  })

  it('rejects passwords shorter than 8 characters', () => {
    renderReset()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument()
    expect(authServiceMock.resetPassword).not.toHaveBeenCalled()
  })

  it('submits a valid reset with email, code and the new password', async () => {
    authServiceMock.resetPassword.mockResolvedValue(undefined)
    renderReset()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() =>
      expect(authServiceMock.resetPassword).toHaveBeenCalledWith('user@example.com', '123456', 'newpassword1'),
    )
  })

  it('surfaces the server error message for an invalid or expired code', async () => {
    authServiceMock.resetPassword.mockRejectedValue({ response: { data: { message: 'Invalid or expired code. Request a new one.' } } })
    renderReset()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByText('Invalid or expired code. Request a new one.')).toBeInTheDocument()
  })
})
