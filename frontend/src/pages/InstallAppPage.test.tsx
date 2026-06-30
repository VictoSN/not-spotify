import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  WINDOWS_MSI_FILENAME,
  WINDOWS_SETUP_FILENAME,
} from '@/config/downloads'
import { InstallAppPage } from './InstallAppPage'

const promptInstall = vi.hoisted(() => vi.fn(async () => true))

vi.mock('@/hooks/useInstallApp', () => ({
  useInstallApp: () => ({
    canPrompt: true,
    isStandalone: false,
    promptInstall,
  }),
}))

describe('InstallAppPage', () => {
  beforeEach(() => {
    promptInstall.mockClear()
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    )
  })

  afterEach(() => vi.restoreAllMocks())

  it('offers the staged Windows setup and MSI files', () => {
    render(<InstallAppPage />)

    expect(screen.getByRole('heading', { name: 'Download Not Spotify for Windows' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download for Windows' })).toHaveAttribute(
      'download',
      WINDOWS_SETUP_FILENAME,
    )
    expect(screen.getByRole('link', { name: 'Download the MSI package instead' })).toHaveAttribute(
      'download',
      WINDOWS_MSI_FILENAME,
    )
  })

  it('keeps the real web-app installer available from the in-app page', async () => {
    render(<InstallAppPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Install web app' }))
    await waitFor(() => expect(promptInstall).toHaveBeenCalledTimes(1))
  })
})
