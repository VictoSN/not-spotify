import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/stores/authStore'
import { SupportPage } from './SupportPage'

function renderSupport(entry = '/support') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SupportPage />
    </MemoryRouter>,
  )
}

describe('SupportPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false })
  })

  it('uses one normal search experience without AI or basic mode tabs', () => {
    renderSupport()

    expect(screen.getByRole('textbox', { name: 'Search support' })).toHaveAttribute(
      'placeholder',
      'Search',
    )
    expect(screen.queryByText('Search with AI')).not.toBeInTheDocument()
    expect(screen.queryByText('Basic Search')).not.toBeInTheDocument()
    expect(screen.queryByText(/AI-powered tool/i)).not.toBeInTheDocument()
  })

  it('opens a complete feature-specific article from a deep link', () => {
    renderSupport('/support?topic=messages-and-sharing')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Messages and sharing music' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Current attachment limits')).toBeInTheDocument()
    expect(screen.getByText(/file transfer is not completed/i)).toBeInTheDocument()
  })

  it('searches the expanded feature catalogue', () => {
    renderSupport('/support?search=upload audio')

    expect(screen.getByRole('link', { name: /Upload your own audio/i })).toHaveAttribute(
      'href',
      '/support?topic=upload-your-own-audio',
    )
  })

  it('shows a real not-found state instead of generated filler', () => {
    renderSupport('/support?topic=made-up-placeholder')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Help article not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse all help topics' })).toHaveAttribute(
      'href',
      '/support',
    )
  })
})
