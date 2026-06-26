import { useCallback, useEffect, useState } from 'react'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Tauri-only "Open at login" preference, backed by the OS launcher via
 * tauri-plugin-autostart. `supported` is false in the browser build so callers
 * can skip rendering the row entirely.
 */
export function useAutostart() {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isTauri) return
    let cancelled = false
    ;(async () => {
      try {
        const { isEnabled } = await import('@tauri-apps/plugin-autostart')
        const value = await isEnabled()
        if (!cancelled) setEnabled(value)
      } catch {
        /* plugin missing or denied — leave as false */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = useCallback(async (next: boolean) => {
    if (!isTauri) return
    setBusy(true)
    try {
      const { enable, disable } = await import('@tauri-apps/plugin-autostart')
      if (next) await enable()
      else await disable()
      setEnabled(next)
    } finally {
      setBusy(false)
    }
  }, [])

  return { supported: isTauri, enabled, busy, toggle }
}
