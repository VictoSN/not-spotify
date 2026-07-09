/*
 * Runtime host detection.
 *
 * The same React bundle runs in three places: a normal browser tab, an
 * installed PWA, and the Tauri desktop shell. Some capabilities (real
 * filesystem downloads, staying logged in offline) are only offered in the
 * desktop app, so we need a reliable way to tell them apart.
 *
 * Tauri v2 injects `window.__TAURI_INTERNALS__` into the webview before our
 * code runs; a plain browser (and an installed PWA) never has it. Note that
 * `display-mode: standalone` is NOT usable here — an installed PWA matches it
 * too, so it can't distinguish the desktop app.
 */

interface TauriWindow {
  __TAURI_INTERNALS__?: unknown
  __TAURI__?: unknown
}

/** True only when running inside the Tauri desktop shell. */
export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as TauriWindow
  return w.__TAURI_INTERNALS__ !== undefined || w.__TAURI__ !== undefined
}
