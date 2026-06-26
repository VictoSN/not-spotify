export const APP_ZOOM_STORAGE_KEY = 'ns-app-zoom'
export const APP_ZOOM_MIN = 0.85
export const APP_ZOOM_MAX = 1.25
export const APP_ZOOM_STEP = 0.05
export const APP_ZOOM_DEFAULT = 1
export const APP_ZOOM_CHANGE_EVENT = 'ns-app-zoom-change'

export function clampAppZoom(value: number) {
  if (!Number.isFinite(value)) return APP_ZOOM_DEFAULT
  const clamped = Math.min(APP_ZOOM_MAX, Math.max(APP_ZOOM_MIN, value))
  return Math.round(clamped * 100) / 100
}

export function readAppZoom() {
  if (typeof window === 'undefined') return APP_ZOOM_DEFAULT
  try {
    const raw = window.localStorage.getItem(APP_ZOOM_STORAGE_KEY)
    return raw == null ? APP_ZOOM_DEFAULT : clampAppZoom(Number(raw))
  } catch {
    return APP_ZOOM_DEFAULT
  }
}

export function applyAppZoom(value: number) {
  if (typeof document === 'undefined') return APP_ZOOM_DEFAULT
  const zoom = clampAppZoom(value)
  document.documentElement.style.setProperty('--ns-app-zoom', String(zoom))
  return zoom
}

export function setAppZoom(value: number) {
  const zoom = applyAppZoom(value)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(APP_ZOOM_STORAGE_KEY, String(zoom))
    } catch {
      /* ignore storage failures */
    }
    window.dispatchEvent(new CustomEvent(APP_ZOOM_CHANGE_EVENT, { detail: { zoom } }))
  }
  return zoom
}

export function resetAppZoom() {
  return setAppZoom(APP_ZOOM_DEFAULT)
}

export function stepAppZoom(direction: 1 | -1) {
  return setAppZoom(readAppZoom() + direction * APP_ZOOM_STEP)
}

export function initAppZoom() {
  return applyAppZoom(readAppZoom())
}
