export type IndependentSite = 'account' | 'support' | 'download'

const INDEPENDENT_SITES: IndependentSite[] = ['account', 'support', 'download']

interface BrowserLocation {
  protocol: string
  hostname: string
  port: string
  origin: string
}

const sitePaths: Record<IndependentSite, string> = {
  account: '/account',
  support: '/support',
  download: '/download',
}

function currentLocation(): BrowserLocation | null {
  return typeof window === 'undefined' ? null : window.location
}

function configuredRootDomain() {
  const configured = import.meta.env.VITE_ROOT_DOMAIN?.trim()
  if (!configured) return null

  try {
    return new URL(configured.includes('://') ? configured : `https://${configured}`).hostname
  } catch {
    return configured.replace(/^\.+|\.+$/g, '')
  }
}

function configuredMainOrigin() {
  const configured = import.meta.env.VITE_MAIN_APP_ORIGIN?.trim()
  if (!configured) return null

  try {
    return new URL(configured.includes('://') ? configured : `https://${configured}`).origin
  } catch {
    return null
  }
}

function rootHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  const configured = configuredRootDomain()
  if (configured) return configured

  if (normalized === 'localhost' || normalized === '127.0.0.1') return 'localhost'
  if (normalized === 'tauri.localhost') return normalized
  if (normalized.startsWith('www.')) return normalized.slice(4)

  const site = INDEPENDENT_SITES.find((candidate) => normalized.startsWith(`${candidate}.`))
  return site ? normalized.slice(site.length + 1) : normalized
}

export function independentSiteFromHostname(hostname = currentLocation()?.hostname ?? ''): IndependentSite | null {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  return INDEPENDENT_SITES.find((site) => normalized.startsWith(`${site}.`)) ?? null
}

export function independentSiteUrl(
  site: IndependentSite,
  suffix = '/',
  location: BrowserLocation | null = currentLocation(),
) {
  if (!location) return sitePaths[site]

  // Tauri has no browser tabs or DNS-backed subdomains, so retain the
  // same-origin route when this UI is running as the packaged desktop app.
  if (location.hostname === 'tauri.localhost' || location.protocol === 'tauri:') {
    return sitePaths[site]
  }

  const root = rootHostname(location.hostname)
  const port = location.port ? `:${location.port}` : ''
  const path = suffix.startsWith('/') ? suffix : `/${suffix}`
  return `${location.protocol}//${site}.${root}${port}${path}`
}

/** Main music-app destination, used by links rendered on an independent site. */
export function mainAppUrl(path = '/', location: BrowserLocation | null = currentLocation()) {
  if (!location || !independentSiteFromHostname(location.hostname)) return path

  const configured = configuredMainOrigin()
  if (configured) return new URL(path, `${configured}/`).toString()

  const root = rootHostname(location.hostname)
  const port = location.port ? `:${location.port}` : ''
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${location.protocol}//${root}${port}${suffix}`
}

export function independentSiteForPath(path: string): IndependentSite | null {
  if (path === '/account' || path.startsWith('/account?')) return 'account'
  if (path === '/support' || path.startsWith('/support?')) return 'support'
  if (path === '/download' || path.startsWith('/download?')) return 'download'
  return null
}

export function independentSiteSuffix(site: IndependentSite, path: string) {
  const base = sitePaths[site]
  const suffix = path.startsWith(base) ? path.slice(base.length) : path
  if (!suffix) return '/'
  return suffix.startsWith('?') ? `/${suffix}` : suffix
}
