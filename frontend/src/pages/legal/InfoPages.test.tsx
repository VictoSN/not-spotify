import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { AboutPage, LegalPage, PrivacyPolicyPage } from './InfoPages'
import { AppFooter } from '@/components/common/AppFooter'

describe('Footer legal/info pages (bug #23)', () => {
  it('About page identifies the team and clearly states its academic, non-distribution purpose', () => {
    render(<MemoryRouter><AboutPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument()
    expect(screen.getByText('Stanlie Lin')).toBeInTheDocument()
    expect(screen.getByText('Marvind Meydie Lincoln')).toBeInTheDocument()
    expect(screen.getByText('Victoria Suwita Nanda')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Copyright and media notice' })).toBeInTheDocument()
    expect(screen.getByText(/not a cracked or modified Spotify website/i)).toBeInTheDocument()
    expect(screen.getByText(/obtained lawfully through purchases or legitimate providers/i)).toBeInTheDocument()
    expect(screen.getByText(/non-commercial status does not by itself grant permission/i)).toBeInTheDocument()
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

  it('footer help links open the matching local support articles', () => {
    render(<MemoryRouter><AppFooter /></MemoryRouter>)

    expect(screen.getByRole('link', { name: 'For Artists' })).toHaveAttribute(
      'href',
      '/support?topic=artist-dashboard',
    )
    expect(screen.getByRole('link', { name: 'Import your music' })).toHaveAttribute(
      'href',
      '/support?topic=upload-your-own-audio',
    )
    expect(screen.getByRole('link', { name: 'Safety & Privacy Center' })).toHaveAttribute(
      'href',
      '/support?topic=privacy-settings',
    )
    expect(screen.getByRole('link', { name: 'Cookies' })).toHaveAttribute(
      'href',
      '/support?topic=cookies-and-local-storage',
    )
    expect(screen.getByRole('link', { name: 'About Ads' })).toHaveAttribute(
      'href',
      '/support?topic=ads-and-sponsored-content',
    )
    expect(screen.getByRole('link', { name: 'Accessibility' })).toHaveAttribute(
      'href',
      '/support?topic=accessibility-and-keyboard-controls',
    )
  })
})
