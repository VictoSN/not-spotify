import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  detectDownloadPlatform,
  WINDOWS_MSI_FILENAME,
  WINDOWS_SETUP_FILENAME,
} from '@/config/downloads'
import { DownloadPage } from './DownloadPage'

const promptInstall = vi.hoisted(() => vi.fn(async () => true))

function renderDownloadPage() {
  return render(
    <MemoryRouter>
      <DownloadPage />
    </MemoryRouter>,
  )
}

vi.mock('@/hooks/useInstallApp', () => ({
  useInstallApp: () => ({
    canPrompt: true,
    isStandalone: false,
    promptInstall,
  }),
}))

describe('download platform detection', () => {
  it.each([
    [
      'Windows',
      { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      'windows',
    ],
    [
      'macOS',
      { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      'macos',
    ],
    [
      'Android',
      { userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9)' },
      'android',
    ],
    [
      'iPhone',
      { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' },
      'ios',
    ],
    [
      'iPad desktop mode',
      {
        userAgent: 'Mozilla/5.0 (Macintosh)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      },
      'ios',
    ],
    ['Linux', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }, 'linux'],
  ] as const)('detects %s', (_label, input, expected) => {
    expect(detectDownloadPlatform(input)).toBe(expected)
  })
})

describe('DownloadPage (bug #15)', () => {
  beforeEach(() => promptInstall.mockClear())

  it('exposes real Windows EXE and MSI download links with stable filenames', () => {
    renderDownloadPage()

    const exeLinks = screen.getAllByRole('link', {
      name: 'Download for Windows',
    })
    expect(exeLinks.length).toBeGreaterThan(0)
    for (const link of exeLinks) {
      expect(link.getAttribute('href')).toMatch(
        new RegExp(`/downloads/${WINDOWS_SETUP_FILENAME}$`),
      )
      expect(link).toHaveAttribute('download', WINDOWS_SETUP_FILENAME)
    }

    const msiLink = screen.getByRole('link', {
      name: 'Download the MSI package instead',
    })
    expect(msiLink.getAttribute('href')).toMatch(
      new RegExp(`/downloads/${WINDOWS_MSI_FILENAME}$`),
    )
    expect(msiLink).toHaveAttribute('download', WINDOWS_MSI_FILENAME)
  })

  it('opens the browser install prompt for the macOS/mobile web app', async () => {
    renderDownloadPage()

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Install web app' })[0],
    )
    await waitFor(() => expect(promptInstall).toHaveBeenCalledTimes(1))
  })
})

describe('DownloadPage (bug #33)', () => {
  beforeEach(() => {
    promptInstall.mockClear()
    sessionStorage.clear()
  })

  it('does not render the mobile/tablet/computer device icon grid', () => {
    renderDownloadPage()

    expect(screen.queryByLabelText('Supported devices')).not.toBeInTheDocument()
  })

  it('shows mobile install steps for both iOS and Android without a toggle', () => {
    renderDownloadPage()

    expect(screen.queryByRole('button', { name: /install steps/i })).not.toBeInTheDocument()
    expect(screen.getByText(/On iPhone or iPad/i)).toBeInTheDocument()
    expect(screen.getByText(/On Android tablet or phone/i)).toBeInTheDocument()
  })
})

describe('DownloadPage (bug #34)', () => {
  it('shows a real app screenshot (not a decorative placeholder) with descriptive alt text', () => {
    renderDownloadPage()

    const shot = screen.getByRole('img', { name: /Not Spotify desktop app/i })
    expect(shot).toHaveAttribute(
      'src',
      'https://d1vs28dc5v6abn.cloudfront.net/storage/app-assets/frontend/public/app-preview.svg',
    )
    // A content image exposed to screen readers — the old mockup was aria-hidden.
    expect(shot).not.toHaveAttribute('aria-hidden')
    expect((shot.getAttribute('alt') ?? '').length).toBeGreaterThan(20)
    // Intrinsic dimensions are set so the layout doesn't shift while it loads.
    expect(shot).toHaveAttribute('width', '1024')
    expect(shot).toHaveAttribute('height', '640')
  })

  it('renders the screenshot responsively with no desktop-only gate', () => {
    renderDownloadPage()

    const shot = screen.getByRole('img', { name: /Not Spotify desktop app/i })
    expect(shot).toHaveClass('w-full')
    // Walk the ancestors: none may carry the standalone `hidden` class that
    // previously limited the artwork to large screens only (`hidden lg:block`).
    for (let el: HTMLElement | null = shot; el; el = el.parentElement) {
      expect(el.className).not.toMatch(/(^|\s)hidden(\s|$)/)
    }
  })
})
