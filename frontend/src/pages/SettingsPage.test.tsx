import React from 'react'
import { act } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'
import { useAuthStore } from '@/stores/authStore'
import { useLocaleStore } from '@/stores/localeStore'
import { useThemeStore } from '@/stores/themeStore'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const notificationMocks = vi.hoisted(() => ({
  checkNotificationsNow: vi.fn(() => Promise.resolve()),
  fireNotification: vi.fn(() => Promise.resolve()),
  requestNotificationPermission: vi.fn(() => Promise.resolve<NotificationPermission>('granted')),
  refreshNotificationPermission: vi.fn(() => Promise.resolve<NotificationPermission>('default')),
  notificationPermission: vi.fn(() => 'default' as NotificationPermission),
}))

vi.mock('@/hooks/useAutostart', () => ({
  useAutostart: () => ({ supported: false, enabled: false, busy: false, toggle: vi.fn() }),
}))

vi.mock('@/services/notifications', () => ({
  isNotificationSupported: () => true,
  checkNotificationsNow: notificationMocks.checkNotificationsNow,
  fireNotification: notificationMocks.fireNotification,
  requestNotificationPermission: notificationMocks.requestNotificationPermission,
  refreshNotificationPermission: notificationMocks.refreshNotificationPermission,
  notificationPermission: notificationMocks.notificationPermission,
}))

vi.mock('@/services/webPush', () => ({
  isPushSupported: () => false,
  isPushSubscribed: vi.fn(() => Promise.resolve(false)),
  PUSH_ENABLED_KEY: 'ns-push-enabled',
  sendPushTest: vi.fn(),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}))

const originalAuthState = useAuthStore.getState()
const cacheDelete = vi.fn(() => Promise.resolve(true))
const cacheKeys = vi.fn(() => Promise.resolve(['not-spotify-v1', 'artwork-v1']))
const estimate = vi.fn(() => Promise.resolve({ usage: 5 * 1024 * 1024 }))

async function renderSettings() {
  const result = render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  return result
}

async function fireAndFlush(action: () => void) {
  await act(async () => {
    action()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('SettingsPage implemented preferences', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    notificationMocks.notificationPermission.mockReturnValue('default')
    notificationMocks.requestNotificationPermission.mockImplementation(async () => {
      notificationMocks.notificationPermission.mockReturnValue('granted')
      return 'granted'
    })
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate },
    })
    vi.stubGlobal('caches', { keys: cacheKeys, delete: cacheDelete })
    act(() => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { plan: 'premium', capabilities: { unlimitedPlayback: true } } as never,
      })
      useThemeStore.getState().setTheme('dark')
      useLocaleStore.getState().setLanguage('en')
    })
  })

  afterEach(() => {
    act(() => {
      useAuthStore.setState(originalAuthState, true)
    })
    vi.unstubAllGlobals()
    window.localStorage.clear()
    document.documentElement.lang = 'en'
    document.documentElement.dataset.theme = 'dark'
  })

  it('persists live audio, playback, library, language, and privacy controls', async () => {
    await renderSettings()

    await fireAndFlush(() => fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'light' } }))
    expect(window.localStorage.getItem('ns-theme')).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')

    await fireAndFlush(() => fireEvent.change(screen.getByLabelText('Streaming quality'), { target: { value: 'veryhigh' } }))
    expect(window.localStorage.getItem('ns-pref-quality')).toBe(JSON.stringify('veryhigh'))

    await fireAndFlush(() => fireEvent.click(screen.getByRole('switch', { name: 'Data Saver' })))
    expect(window.localStorage.getItem('ns-pref-data-saver')).toBe('true')
    expect(screen.getByLabelText('Streaming quality')).toHaveValue('low')

    await fireAndFlush(() => fireEvent.click(screen.getByRole('switch', { name: 'Normalize volume' })))
    expect(window.localStorage.getItem('ns-pref-normalize')).toBe('true')

    await fireAndFlush(() => fireEvent.click(screen.getByRole('switch', { name: 'Use compact library layout' })))
    expect(window.localStorage.getItem('ns-pref-compact')).toBe('true')

    await fireAndFlush(() => fireEvent.click(screen.getByRole('switch', { name: 'Autoplay similar content when your music ends' })))
    expect(window.localStorage.getItem('ns-pref-autoplay')).toBe('false')

    await fireAndFlush(() => fireEvent.change(screen.getByLabelText('Crossfade songs'), { target: { value: '9' } }))
    expect(window.localStorage.getItem('ns-pref-crossfade')).toBe('9')

    await fireAndFlush(() => fireEvent.click(screen.getByRole('switch', { name: 'Private listening' })))
    expect(window.localStorage.getItem('ns-pref-private-listening')).toBe('true')

    await fireAndFlush(() => fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'fr' } }))
    expect(window.localStorage.getItem('ns-pref-language')).toBe(JSON.stringify('fr'))
    expect(document.documentElement.lang).toBe('fr')
  })

  it('requests notification permission before enabling notification-backed toggles', async () => {
    await renderSettings()

    await fireAndFlush(() => fireEvent.click(screen.getByRole('switch', { name: 'Allow notifications' })))
    await waitFor(() => expect(notificationMocks.requestNotificationPermission).toHaveBeenCalledTimes(1))
    expect(window.localStorage.getItem('ns-notif-enabled')).toBe('true')

    await fireAndFlush(() => fireEvent.click(screen.getByRole('switch', { name: 'New release alerts' })))
    expect(window.localStorage.getItem('ns-notif-release-alerts')).toBe('true')
    expect(notificationMocks.checkNotificationsNow).toHaveBeenCalledTimes(1)

    await fireAndFlush(() => fireEvent.click(screen.getByRole('switch', { name: 'Friend activity' })))
    expect(window.localStorage.getItem('ns-notif-friend-activity')).toBe('true')
    expect(notificationMocks.checkNotificationsNow).toHaveBeenCalledTimes(2)

    await fireAndFlush(() => fireEvent.click(screen.getByRole('switch', { name: 'A friend replies in chat' })))
    expect(window.localStorage.getItem('ns-notif-friend-chat')).toBe('false')
  })

  async function openSearch() {
    await fireAndFlush(() => fireEvent.click(screen.getByRole('button', { name: 'Search settings' })))
    return screen.getByLabelText('Search settings') as HTMLInputElement
  }

  it('filters settings as the user types and is case-insensitive / partial', async () => {
    await renderSettings()
    const input = await openSearch()

    // "theme" → keeps the Theme control, drops unrelated rows.
    await fireAndFlush(() => fireEvent.change(input, { target: { value: 'theme' } }))
    expect(screen.getByLabelText('Theme')).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Private listening' })).not.toBeInTheDocument()

    // Case-insensitive: "THEME" behaves the same.
    await fireAndFlush(() => fireEvent.change(input, { target: { value: 'THEME' } }))
    expect(screen.getByLabelText('Theme')).toBeInTheDocument()

    // Partial match: "priv" surfaces "Private listening".
    await fireAndFlush(() => fireEvent.change(input, { target: { value: 'priv' } }))
    expect(screen.getByRole('switch', { name: 'Private listening' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Theme')).not.toBeInTheDocument()
  })

  it('shows a "No results found" state for non-matching queries', async () => {
    await renderSettings()
    const input = await openSearch()

    await fireAndFlush(() => fireEvent.change(input, { target: { value: 'zzzzqqqq' } }))
    expect(screen.getByText(/No results found/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Theme')).not.toBeInTheDocument()
  })

  it('restores all settings when the search is cleared', async () => {
    await renderSettings()
    const input = await openSearch()

    await fireAndFlush(() => fireEvent.change(input, { target: { value: 'theme' } }))
    expect(screen.queryByRole('switch', { name: 'Private listening' })).not.toBeInTheDocument()

    await fireAndFlush(() => fireEvent.click(screen.getByRole('button', { name: 'Clear settings search' })))
    expect(screen.getByLabelText('Theme')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Private listening' })).toBeInTheDocument()
  })

  it('reads and clears browser media cache usage', async () => {
    await renderSettings()

    expect(await screen.findByText(/Approximately 5\.0 MB used/)).toBeInTheDocument()
    await fireAndFlush(() => fireEvent.click(screen.getByRole('button', { name: 'Clear cache' })))

    await waitFor(() => expect(cacheDelete).toHaveBeenCalledWith('not-spotify-v1'))
    expect(cacheDelete).toHaveBeenCalledWith('artwork-v1')
    expect(estimate).toHaveBeenCalled()
  })
})
