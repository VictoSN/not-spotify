import { create } from 'zustand'
import { useAuthStore } from './authStore'
import type { RemotePlaybackState } from '@/services/connectClient'

export interface ConnectDevice {
  deviceId: string
  kind: string
  name: string
  isActive: boolean
}

// --- This browser tab's stable identity ------------------------------------
// One id per tab (sessionStorage survives reload but not a new tab), so every
// tab/app is its own "device" — matching how Spotify treats each web player.

function readDeviceId(): string {
  try {
    let id = sessionStorage.getItem('ns-device-id')
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem('ns-device-id', id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

function detectKind(): string {
  if (typeof window !== 'undefined' && '__TAURI__' in window) return 'desktop'
  if (typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) return 'mobile'
  return 'web'
}

function detectName(kind: string): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const browser = /Edg/.test(ua) ? 'Edge'
    : /OPR|Opera/.test(ua) ? 'Opera'
    : /Chrome/.test(ua) ? 'Chrome'
    : /Firefox/.test(ua) ? 'Firefox'
    : /Safari/.test(ua) ? 'Safari'
    : 'Browser'
  const os = /Windows/.test(ua) ? 'Windows'
    : /Mac/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Linux/.test(ua) ? 'Linux'
    : ''
  if (kind === 'desktop') return `Desktop app${os ? ` · ${os}` : ''}`
  return `${browser}${os ? ` · ${os}` : ''}`
}

const thisDeviceId = readDeviceId()
const thisDeviceKind = detectKind()
const thisDeviceName = detectName(thisDeviceKind)

interface ConnectState {
  thisDeviceId: string
  thisDeviceKind: string
  thisDeviceName: string
  devices: ConnectDevice[]
  activeDeviceId: string | null
  /** Last playback state pushed by the active device (populated on mirrors). */
  remoteState: RemotePlaybackState | null

  setRoster: (devices: ConnectDevice[], activeDeviceId: string | null) => void
  setRemoteState: (state: RemotePlaybackState) => void
  reset: () => void
}

export const useConnectStore = create<ConnectState>((set) => ({
  thisDeviceId,
  thisDeviceKind,
  thisDeviceName,
  devices: [],
  activeDeviceId: null,
  remoteState: null,

  setRoster: (devices, activeDeviceId) => set({ devices, activeDeviceId }),
  setRemoteState: (remoteState) => set({ remoteState }),
  reset: () => set({ devices: [], activeDeviceId: null, remoteState: null }),
}))

/** True when THIS tab is the account's active (audio) device. A lone device is
 *  active by default (activeDeviceId is null until the roster arrives). */
export function isThisDeviceActive(): boolean {
  const { thisDeviceId: id, activeDeviceId } = useConnectStore.getState()
  return activeDeviceId == null || activeDeviceId === id
}

/** The device currently playing audio, or null when it's this one / unknown. */
export function activeRemoteDevice(): ConnectDevice | null {
  const { activeDeviceId, thisDeviceId: id, devices } = useConnectStore.getState()
  if (!activeDeviceId || activeDeviceId === id) return null
  return devices.find((d) => d.deviceId === activeDeviceId) ?? null
}

// Clear the roster on logout so a different account doesn't inherit devices.
useAuthStore.subscribe((state, prev) => {
  if (prev.isAuthenticated && !state.isAuthenticated) {
    useConnectStore.getState().reset()
  }
})
