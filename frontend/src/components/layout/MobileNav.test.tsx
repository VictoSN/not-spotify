import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { MobileNav } from './MobileNav'
import { useAuthStore } from '@/stores/authStore'
import { useLocaleStore } from '@/stores/localeStore'
import { usePlayerStore } from '@/stores/playerStore'

describe('MobileNav navigation', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
    useLocaleStore.setState({ language: 'en' })
    usePlayerStore.setState({ isKaraokeOpen: true })
  })

  it('closes karaoke from primary tab navigation', () => {
    render(
      <MemoryRouter initialEntries={['/search']}>
        <MobileNav />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('link', { name: /Library/i }))

    expect(usePlayerStore.getState().isKaraokeOpen).toBe(false)
  })

  it('closes karaoke from the profile/login tab', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileNav />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(usePlayerStore.getState().isKaraokeOpen).toBe(false)
  })
})
