/**
 * Cross-surface account handoff (desktop app -> system browser).
 *
 * The Tauri desktop app and the system browser keep completely separate sessions.
 * When the desktop app (signed in as B) opens a page like /account in the browser,
 * the browser may be signed in as a different account (A). We never move JWTs, refresh
 * tokens, passwords or cookies through the URL. The request query contains only a
 * NON-SECRET hint (the expected user id and a masked email) plus the intended
 * destination. For convenience, the full login email may be carried in the URL
 * fragment: fragments stay in the browser and are not sent in HTTP requests or CDN
 * logs. The web app removes it from the address bar as soon as it prefills LoginPage.
 *
 * Everything here is pure and framework-free so it can be unit-tested directly.
 */

export const HANDOFF_PATH = '/handoff'
const HANDOFF_EMAIL_FRAGMENT_PARAM = 'email'

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

function validPrefillEmail(value: string | null | undefined): string | null {
  const raw = value ?? ''
  const hasControlCharacter = [...raw].some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })
  const email = raw.trim()
  if (
    !email ||
    email.length > 254 ||
    hasControlCharacter
  ) return null
  const at = email.indexOf('@')
  if (at <= 0 || at !== email.lastIndexOf('@') || at === email.length - 1) return null
  return email
}

/** Build a client-only fragment containing the account email for LoginPage. */
export function buildHandoffEmailFragment(email: string | null | undefined): string {
  const valid = validPrefillEmail(email)
  if (!valid) return ''
  return `#${new URLSearchParams({ [HANDOFF_EMAIL_FRAGMENT_PARAM]: valid }).toString()}`
}

/** Read and validate the email prefill carried in a handoff URL fragment. */
export function parseHandoffEmailFragment(hash: string | null | undefined): string | null {
  if (!hash) return null
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  return validPrefillEmail(params.get(HANDOFF_EMAIL_FRAGMENT_PARAM))
}

/**
 * Mask an email for display: keep the first character and the domain, hide the rest of
 * the local part. Returns a neutral label when the input is missing or malformed.
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
 * Build the handoff path the desktop app opens in the browser. The request query carries
 * only the expected account id and masked hint. The full email is placed after `#`, where
 * it remains client-side, so LoginPage can prefill it without exposing it to server logs.
 */
export function buildHandoffPath(dest: string, user: { id: string; email: string } | null | undefined): string {
  const params = new URLSearchParams()
  if (user?.id) {
    params.set(HANDOFF_PARAMS.account, user.id)
    params.set(HANDOFF_PARAMS.hint, maskEmail(user.email))
  }
  params.set(HANDOFF_PARAMS.next, dest)
  return `${HANDOFF_PATH}?${params.toString()}${buildHandoffEmailFragment(user?.email)}`
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
