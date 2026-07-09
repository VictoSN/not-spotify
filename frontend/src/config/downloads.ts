export type DownloadPlatform =
  | 'windows'
  | 'macos'
  | 'ios'
  | 'android'
  | 'linux'
  | 'other'

export interface PlatformDetectionInput {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
}

export const INSTALLER_VERSION =
  typeof __APP_VERSION__ === 'undefined' ? 'dev' : __APP_VERSION__
export const WINDOWS_SETUP_FILENAME = `not-spotify_${INSTALLER_VERSION}_x64-setup.exe`
export const WINDOWS_MSI_FILENAME = `not-spotify_${INSTALLER_VERSION}_x64_en-US.msi`

function installerUrl(filename: string): string {
  const baseUrl = (
    import.meta.env.VITE_INSTALLER_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    ''
  ).replace(/\/$/, '')

  return `${baseUrl}/downloads/${filename}`
}

export const WINDOWS_SETUP_URL = installerUrl(WINDOWS_SETUP_FILENAME)
export const WINDOWS_MSI_URL = installerUrl(WINDOWS_MSI_FILENAME)

/**
 * Detects the visitor's operating system for the recommended download action.
 * iPadOS is checked before macOS because desktop-mode Safari identifies itself
 * as a Mac while still exposing multiple touch points.
 */
export function detectDownloadPlatform(
  input: PlatformDetectionInput = {},
): DownloadPlatform {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  const userAgent = (input.userAgent ?? nav?.userAgent ?? '').toLowerCase()
  const platform = (input.platform ?? nav?.platform ?? '').toLowerCase()
  const maxTouchPoints = input.maxTouchPoints ?? nav?.maxTouchPoints ?? 0

  if (userAgent.includes('android')) return 'android'
  if (
    /iphone|ipad|ipod/.test(userAgent) ||
    (platform.includes('mac') && maxTouchPoints > 1)
  )
    return 'ios'
  if (userAgent.includes('windows') || platform.includes('win'))
    return 'windows'
  if (
    userAgent.includes('macintosh') ||
    userAgent.includes('mac os') ||
    platform.includes('mac')
  )
    return 'macos'
  if (userAgent.includes('linux') || platform.includes('linux')) return 'linux'
  return 'other'
}

export const PLATFORM_LABELS: Record<DownloadPlatform, string> = {
  windows: 'Windows',
  macos: 'macOS',
  ios: 'iPhone or iPad',
  android: 'Android',
  linux: 'Linux',
  other: 'your device',
}
