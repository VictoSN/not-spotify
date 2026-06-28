import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { AboutPage, LegalPage, PrivacyPolicyPage } from './InfoPages'
import { AppFooter } from '@/components/common/AppFooter'

describe('Footer legal/info pages (bug #23)', () => {
  it('About page loads with its heading', () => {
    render(<MemoryRouter><AboutPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument()
  })

  it('Legal page loads with its heading', () => {
    render(<MemoryRouter><LegalPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: 'Legal' })).toBeInTheDocument()
  })

  it('Privacy page loads with its heading', () => {
    render(<MemoryRouter><PrivacyPolicyPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
  })

  it('footer points About / Legal / Privacy links to real pages, not /support', () => {
    render(<MemoryRouter><AppFooter /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about')
    expect(screen.getByRole('link', { name: 'Legal' })).toHaveAttribute('href', '/legal')
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')

    // No footer link should be a dead end pointing nowhere; every link has a target.
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).toBeTruthy()
    }
  })
})
