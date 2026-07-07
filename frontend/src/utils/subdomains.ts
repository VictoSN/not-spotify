// Helpers for linking to the app's dedicated section subdomains (account/support/
// download/admin.not-spotify.lol) from anywhere in the SPA. Each subdomain serves the
// same bundle but is the "home domain" for its section — see the SUBDOMAIN_LANDINGS +
// reset rule in `router/index.tsx`. These builders let a link land on the right domain
// in the SAME tab, while degrading to plain in-app paths on localhost / the primary
// domain so dev and same-domain navigation keep using client-side routing.

// Leading labels we recognise as subdomains (so we can strip them to find the apex).
const SECTION_SUBDOMAINS = new Set(['account', 'support', 'download', 'admin', 'www', 'api'])

/** The registrable/apex domain for a host, dropping a known leading subdomain label. */
function baseDomain(hostname: string): string {
  const parts = hostname.split('.')
  return parts.length > 2 && SECTION_SUBDOMAINS.has(parts[0]) ? parts.slice(1).join('.') : hostname
}

/** Absolute URL for `targetHost + path`, or null when it's the current host (→ use
 *  client routing) — keeps same-domain navigation as a fast SPA transition. */
function crossDomainUrl(targetHost: string, path: string): string | null {
  if (typeof window === 'undefined') return null
  const { hostname, protocol } = window.location
  return targetHost === hostname ? null : `${protocol}//${targetHost}${path}`
}

/**
 * URL for a section on its dedicated subdomain, e.g. `sectionUrl('support', '/support')`
 * → `https://support.not-spotify.lol/support`. Returns null on localhost / bare hosts
 * (no subdomain routing) so callers fall back to in-app `<Link>` navigation.
 */
export function sectionUrl(subdomain: string, path: string): string | null {
  if (typeof window === 'undefined') return null
  const base = baseDomain(window.location.hostname)
  if (!base.includes('.')) return null
  return crossDomainUrl(`${subdomain}.${base}`, path)
}

/** URL for a path on the primary (apex) domain, e.g. `https://not-spotify.lol/premium`. */
export function primaryUrl(path: string): string | null {
  if (typeof window === 'undefined') return null
  const base = baseDomain(window.location.hostname)
  if (!base.includes('.')) return null
  return crossDomainUrl(base, path)
}
