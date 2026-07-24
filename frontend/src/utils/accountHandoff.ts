/**
 * Cross-surface account handoff (desktop app -> system browser).
 *
 * The Tauri desktop app and the system browser keep completely separate sessions.
 * When the desktop app (signed in as B) opens a page like /account in the browser,
 * the browser may be signed in as a different account (A). We never move JWTs, refresh
 * tokens, passwords or cookies through the URL — the app passes only a NON-SECRET hint
 * (the expected user id and a masked email) plus the intended destination, and the web
 * app resolves the mismatch with an explicit, user-driven interstitial (see
 * AccountHandoffPage).
 *
 * Everything here is pure and framework-free so it can be unit-tested directly.
 */

export const HANDOFF_PATH = '/handoff'

/** Query-parameter names carried on the handoff URL. All values are non-secret. */
export const HANDOFF_PARAMS = {
  /** Expected account: the app's user id (an opaque GUID, not PII). */
  account: 'acct',
  /** Masked email for display only, e.g. "n•••@example.com". Never a full address. */
  hint: 'hint',
  /** Intended destination path, validated against the allow-list below. */
  next: 'next',
} as const

/**
 * Destinations a return path is allowed to point at. The check is an allow-list, not a
 * block-list, so an attacker cannot smuggle an open redirect through `next=`.
 */
const ALLOWED_RETURN_PREFIXES = [
  '/account',
  '/support',
  '/download',
  '/premium',
  '/settings',
  '/profile',
  '/uploads',
  HANDOFF_PATH, // login bounces back through the handoff to re-check the account
]

export const DEFAULT_RETURN_PATH = '/'

/**
 * Mask an email for display: keep the first character and the domain, hide the rest of
 * the local part. Returns a neutral label when the input is missing or malformed, so we
 * never accidentally render a raw address. The masking happens on the desktop side too,
 * so a full address is never placed in a URL in the first place.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return 'another account'
  const at = email.indexOf('@')
  if (at <= 0 || at === email.length - 1) return 'another account'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const head = local.slice(0, 1)
  const dots = '•'.repeat(Math.min(Math.max(local.length - 1, 2), 4))
  return `${head}${dots}@${domain}`
}

/**
 * True only for safe, internal return paths. Rejects protocol-relative URLs, absolute
 * URLs, any scheme (javascript:, data:, …), control characters, and anything whose first
 * path segment is not on the allow-list. Query strings and fragments are permitted (the
 * login round-trip returns to `/handoff?...`), but only the path portion is trusted.
 */
export function isSafeReturnPath(path: string | null | undefined): path is string {
  if (!path || typeof path !== 'string') return false
  if (!path.startsWith('/')) return false
  if (path.startsWith('//') || path.startsWith('/\\')) return false

  let pathname: string
  try {
    pathname = decodeURIComponent(path.split(/[?#]/, 1)[0])
  } catch {
    return false // malformed percent-encoding
  }

  if ([...pathname].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return false // control chars
  if (pathname.startsWith('//') || pathname.startsWith('/\\')) return false
  if (/^\/*[a-z][a-z0-9+.-]*:/i.test(pathname)) return false // any URL scheme

  if (pathname === DEFAULT_RETURN_PATH) return true
  return ALLOWED_RETURN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Coerce a candidate return path to a safe one, falling back to the site root. */
export function safeReturnPath(path: string | null | undefined): string {
  return isSafeReturnPath(path) ? path : DEFAULT_RETURN_PATH
}

/**
 * Build the handoff path the desktop app opens in the browser. Carries the expected
 * account id and a masked email hint only — no secrets. `dest` is where the browser
 * should land once the account is confirmed.
 */
export function buildHandoffPath(dest: string, user: { id: string; email: string } | null | undefined): string {
  const params = new URLSearchParams()
  if (user?.id) {
    params.set(HANDOFF_PARAMS.account, user.id)
    params.set(HANDOFF_PARAMS.hint, maskEmail(user.email))
  }
  params.set(HANDOFF_PARAMS.next, dest)
  return `${HANDOFF_PATH}?${params.toString()}`
}

export interface HandoffHint {
  /** Expected account id, or null when the app could not supply one. */
  account: string | null
  /** Masked email for display, or null. */
  hint: string | null
  /** Safe destination path (already validated). */
  next: string
}

/** Read and sanitise the handoff hint from a URL search string. */
export function parseHandoffHint(search: string | URLSearchParams): HandoffHint {
  const p = typeof search === 'string' ? new URLSearchParams(search) : search
  return {
    account: p.get(HANDOFF_PARAMS.account) || null,
    hint: p.get(HANDOFF_PARAMS.hint) || null,
    next: safeReturnPath(p.get(HANDOFF_PARAMS.next)),
  }
}
