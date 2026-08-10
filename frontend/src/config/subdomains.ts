// Builds an absolute URL to a sibling subdomain (e.g. https://account.not-spotify.lol/account).
//
// The account menu's "leave the app" items (Account / Family / Support / Download)
// point at dedicated subdomains that serve the same SPA and land on their own
// section (see SUBDOMAIN_LANDINGS in router/index.tsx). A React Router <Link> can't
// cross to another host, so those items use a plain <a href={subdomainUrl(...)}>.
//
// `path` is BOTH the route appended to the subdomain AND the same-origin fallback:
// on localhost, a raw storage endpoint, or an IP, there are no subdomains, so
// we return the relative path and the link just opens that route in a new tab.
const PUBLIC_BASE_DOMAIN = 'not-spotify.lol'

export function subdomainUrl(sub: string, path: string): string {
  if (typeof window === 'undefined') return path
  const host = window.location.hostname
  const isBareHost =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.endsWith('.supabase.co')
  if (isBareHost) return path

  const labels = host.split('.')
  if (labels.length < 2) return path
  const base = labels.slice(-2).join('.') // e.g. not-spotify.lol
  return `https://${sub}.${base}${path}`
}

/**
 * Absolute production URL used when the installed desktop app hands a page off to
 * the system browser. The Tauri webview runs on a localhost-style origin, so it
 * cannot derive the public website domain from window.location.
 */
export function publicSubdomainUrl(sub: string, path: string): string {
  return `https://${sub}.${PUBLIC_BASE_DOMAIN}${path}`
}
