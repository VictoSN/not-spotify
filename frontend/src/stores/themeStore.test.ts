import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Stub matchMedia BEFORE themeStore is imported, so the module-level
// "system theme changed" listener attaches to our controllable mock.
const media = vi.hoisted(() => {
  const state = { matches: true, listeners: new Set<() => void>() }
  ;(globalThis as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) => ({
    matches: state.matches,
    media: q,
    onchange: null,
    addEventListener: (_: string, cb: () => void) => state.listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => state.listeners.delete(cb),
    addListener: (cb: () => void) => state.listeners.add(cb),
    removeListener: (cb: () => void) => state.listeners.delete(cb),
    dispatchEvent: () => true,
  })
  return state
})

import { useAuthStore } from './authStore'
import { useThemeStore } from './themeStore'

function setSystemDark(dark: boolean) {
  media.matches = dark
  // Fire the OS-level change so the store's listener re-resolves.
  act(() => {
    media.listeners.forEach((l) => l())
  })
}

function becomeGuest() {
  act(() => useAuthStore.setState({ isAuthenticated: false, isInitializing: false }))
}

function becomeMember() {
  act(() => useAuthStore.setState({ isAuthenticated: true, isInitializing: false }))
}

describe('themeStore guest follows system theme (bug 21)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    media.matches = true // system = dark by default
  })

  afterEach(() => {
    document.documentElement.dataset.theme = 'dark'
  })

  it('a guest follows the device theme (dark)', () => {
    media.matches = true
    becomeGuest()
    expect(useThemeStore.getState().followSystem).toBe(true)
    expect(useThemeStore.getState().theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('a guest follows the device theme (light)', () => {
    media.matches = false
    becomeGuest()
    expect(useThemeStore.getState().theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('updates live when the device theme changes', () => {
    media.matches = true
    becomeGuest()
    expect(useThemeStore.getState().theme).toBe('dark')

    setSystemDark(false)
    expect(useThemeStore.getState().theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('ignores setTheme/toggleTheme while a guest', () => {
    media.matches = true
    becomeGuest()
    act(() => useThemeStore.getState().setTheme('light'))
    expect(useThemeStore.getState().theme).toBe('dark')
    expect(window.localStorage.getItem('ns-theme')).toBeNull()

    act(() => useThemeStore.getState().toggleTheme())
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('a signed-in user uses their saved preference and can change it', () => {
    window.localStorage.setItem('ns-theme', 'light')
    becomeMember()
    expect(useThemeStore.getState().followSystem).toBe(false)
    expect(useThemeStore.getState().theme).toBe('light')

    act(() => useThemeStore.getState().setTheme('dark'))
    expect(window.localStorage.getItem('ns-theme')).toBe('dark')
    expect(useThemeStore.getState().theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('hands control back to the device theme on logout', () => {
    window.localStorage.setItem('ns-theme', 'light')
    becomeMember()
    expect(useThemeStore.getState().theme).toBe('light')

    media.matches = true // device = dark
    becomeGuest()
    expect(useThemeStore.getState().followSystem).toBe(true)
    expect(useThemeStore.getState().theme).toBe('dark')
  })
})
