import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { TopBar } from './TopBar'
import { useAuthStore } from '@/stores/authStore'
import { useLocaleStore } from '@/stores/localeStore'
import { usePlayerStore } from '@/stores/playerStore'

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
})
