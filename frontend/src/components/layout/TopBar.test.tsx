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

describe('TopBar context-aware account menu (bug 14)', () => {
  const signIn = (roles: string[] = []) => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'u1', name: 'Test', avatarUrl: null, plan: 'free', roles } as never,
    })
  }

  const openMenu = (route: string) => {
    render(
      <MemoryRouter initialEntries={[route]}>
        <TopBar />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'User menu' }))
  }

  beforeEach(() => {
    useLocaleStore.setState({ language: 'en' })
    usePlayerStore.setState({ isKaraokeOpen: false })
  })

  it('hides "Account" and shows "Artist Dashboard" on the Account page', () => {
    signIn(['Artist'])
    openMenu('/account')

    expect(screen.queryByRole('link', { name: 'Account' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Artist Dashboard' })).toHaveAttribute('href', '/artist-dashboard')
  })

  it('hides "Artist Dashboard" and shows "Account" on the Artist Dashboard', () => {
    signIn(['Artist'])
    openMenu('/artist-dashboard')

    expect(screen.queryByRole('link', { name: 'Artist Dashboard' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument()
  })

  it('shows both "Account" and "Artist Dashboard" on other pages', () => {
    signIn(['Artist'])
    openMenu('/')

    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
    expect(screen.getByRole('link', { name: 'Artist Dashboard' })).toHaveAttribute('href', '/artist-dashboard')
  })

  it('shows "Account" (no Artist Dashboard) for non-artists on other pages', () => {
    signIn([])
    openMenu('/')

    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
    expect(screen.queryByRole('link', { name: 'Artist Dashboard' })).not.toBeInTheDocument()
  })
})
