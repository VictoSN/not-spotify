// Builds an absolute URL to a sibling subdomain (e.g. https://account.not-spotify.lol/account).
//
// The account menu's "leave the app" items (Account / Family / Support / Download)
// point at dedicated subdomains that serve the same SPA and land on their own
// section (see SUBDOMAIN_LANDINGS in router/index.tsx). A React Router <Link> can't
// cross to another host, so those items use a plain <a href={subdomainUrl(...)}>.
//
// `path` is BOTH the route appended to the subdomain AND the same-origin fallback:
// on localhost, the raw S3 website endpoint, or an IP, there are no subdomains, so
// we return the relative path and the link just opens that route in a new tab.
export function subdomainUrl(sub: string, path: string): string {
  if (typeof window === 'undefined') return path
  const host = window.location.hostname
  const isBareHost =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.endsWith('.amazonaws.com')
  if (isBareHost) return path

  const labels = host.split('.')
  if (labels.length < 2) return path
  const base = labels.slice(-2).join('.') // e.g. not-spotify.lol
  return `https://${sub}.${base}${path}`
}
