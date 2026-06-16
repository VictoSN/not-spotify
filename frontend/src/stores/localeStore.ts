import { create } from 'zustand'
import { LANGUAGES, type LanguageCode } from '@/i18n/translations'

// Shared with the old Settings `usePref` key so existing stored values carry over.
const STORAGE_KEY = 'ns-pref-language'

function isValid(code: unknown): code is LanguageCode {
  return typeof code === 'string' && LANGUAGES.some((l) => l.code === code)
}

function getInitial(): LanguageCode {
  if (typeof window === 'undefined') return 'en'
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return 'en'
    // `usePref` historically stored JSON (e.g. '"en"'); also accept a plain code.
    let val: unknown = raw
    try {
      val = JSON.parse(raw)
    } catch {
      /* not JSON — treat as a plain code */
    }
    return isValid(val) ? val : 'en'
  } catch {
    return 'en'
  }
}

function applyLang(code: LanguageCode) {
  if (typeof document !== 'undefined') document.documentElement.lang = code
}

interface LocaleState {
  language: LanguageCode
  setLanguage: (code: LanguageCode) => void
}

const initial = getInitial()
// Keep <html lang> in sync as soon as the store module loads.
applyLang(initial)

export const useLocaleStore = create<LocaleState>((set) => ({
  language: initial,
  setLanguage: (code) => {
    try {
      // Stay JSON-compatible with the legacy `usePref('ns-pref-language')` format
      // and notify other ns-pref listeners.
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(code))
      window.dispatchEvent(new CustomEvent('ns-pref-change', { detail: { key: STORAGE_KEY, value: code } }))
    } catch {
      /* ignore storage failures (private mode, etc.) */
    }
    applyLang(code)
    set({ language: code })
  },
}))
