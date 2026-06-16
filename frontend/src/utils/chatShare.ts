/**
 * Share-to-chat encoding.
 *
 * A shared track is sent as an ordinary chat message whose body is a sentinel
 * token (`ns:share:track:<id>`). This needs ZERO backend change — the chat
 * endpoint stores the string as-is, and the recipient's client detects the
 * token and renders a rich track card instead of plain text. Bodies that don't
 * match are shown as normal messages.
 */
const TRACK_SHARE_PREFIX = 'ns:share:track:'

export function encodeTrackShare(trackId: string): string {
  return `${TRACK_SHARE_PREFIX}${trackId}`
}

export function parseTrackShare(body: string): { trackId: string } | null {
  if (!body.startsWith(TRACK_SHARE_PREFIX)) return null
  const trackId = body.slice(TRACK_SHARE_PREFIX.length).trim()
  return trackId ? { trackId } : null
}
