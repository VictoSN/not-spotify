import { create } from 'zustand'
import { useAuthStore } from './authStore'
import { independentSiteFromHostname } from '@/utils/independentSites'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'ns-theme'

/** The signed-in user's saved choice (defaults to dark when unset). */
function storedPreference(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'dark'
}

/** The device's current light/dark preference (defaults to dark when unknown). */
function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme
  }
}

/**
 * Bug 21: guests don't get to pick a theme — they follow the device's
 * light/dark setting. We only treat the user as a guest once auth has finished
 * initializing, so a returning signed-in user keeps their saved theme through
 * the cookie-refresh handshake instead of flashing the system theme.
 */
function isGuest(): boolean {
  const { isAuthenticated, isInitializing } = useAuthStore.getState()
  return !isAuthenticated && !isInitializing
}

function hasFixedDarkTheme() {
  return typeof window !== 'undefined' && independentSiteFromHostname() !== null
}

interface ThemeState {
  theme: Theme
  /** True while the theme is mirroring the device (guest mode). */
  followSystem: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const initialFixedDark = hasFixedDarkTheme()
const initialFollow = !initialFixedDark && isGuest()
const initialTheme = initialFixedDark ? 'dark' : initialFollow ? systemTheme() : storedPreference()
// Keep <html data-theme> in sync as soon as the store module loads.
applyTheme(initialTheme)

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  followSystem: initialFollow,
  setTheme: (theme) => {
    if (hasFixedDarkTheme()) return
    // Guests can't override the device theme (the picker is hidden for them, so
    // this is just defense in depth).
    if (get().followSystem) return
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* ignore storage failures (private mode, etc.) */
    }
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () => {
    if (get().followSystem) return
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark')
  },
}))

/** Re-derive the effective theme from the current auth + device state. */
function resolveTheme() {
  const fixedDark = hasFixedDarkTheme()
  const followSystem = !fixedDark && isGuest()
  const theme = fixedDark ? 'dark' : followSystem ? systemTheme() : storedPreference()
  applyTheme(theme)
  useThemeStore.setState({ theme, followSystem })
}

// Login, logout, and the initial cookie-refresh all flip guest <-> member; each
// re-resolves the theme (signed-in users → saved choice, guests → device).
useAuthStore.subscribe(resolveTheme)

// Live-update when the device theme changes — only takes effect in guest mode.
if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystemChange = () => {
    if (useThemeStore.getState().followSystem) resolveTheme()
  }
  if (mq.addEventListener) mq.addEventListener('change', onSystemChange)
  else mq.addListener?.(onSystemChange) // older Safari
}
