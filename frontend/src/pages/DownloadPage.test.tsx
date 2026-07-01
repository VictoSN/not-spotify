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

  it('toggles the install steps section open and closed', () => {
    renderDownloadPage()

    const toggle = screen.getByRole('button', { name: /install steps/i })
    const wasExpanded = toggle.getAttribute('aria-expanded') === 'true'

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', String(!wasExpanded))
    expect(toggle).toHaveTextContent(wasExpanded ? 'Show install steps' : 'Hide install steps')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', String(wasExpanded))
  })

  it('persists the install-steps toggle state across remounts within the session', () => {
    const { unmount } = renderDownloadPage()

    const toggle = screen.getByRole('button', { name: /install steps/i })
    const initial = toggle.getAttribute('aria-expanded')
    fireEvent.click(toggle)
    const flipped = toggle.getAttribute('aria-expanded')
    expect(flipped).not.toBe(initial)

    unmount()
    renderDownloadPage()

    expect(screen.getByRole('button', { name: /install steps/i })).toHaveAttribute('aria-expanded', flipped)
  })
})
