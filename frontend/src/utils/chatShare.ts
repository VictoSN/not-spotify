/**
 * Share-to-chat encoding.
 *
 * A shared track/album/playlist is sent as an ordinary chat message whose body
 * is a sentinel token (`ns:share:<kind>:<id>`). This needs ZERO backend change —
 * the chat endpoint stores the string as-is, and the recipient's client detects
 * the token and renders a rich card instead of plain text. Bodies that don't
 * match are shown as normal messages.
 */
const PREFIX = 'ns:share:'

export type ShareKind = 'track' | 'album' | 'playlist' | 'jam'

export interface ParsedShare {
  kind: ShareKind
  id: string
  name?: string
}

function encode(kind: ShareKind, id: string): string {
  return `${PREFIX}${kind}:${id}`
}

export function encodeTrackShare(trackId: string): string {
  return encode('track', trackId)
}

export function encodeAlbumShare(albumId: string): string {
  return encode('album', albumId)
}

export function encodePlaylistShare(playlistId: string): string {
  return encode('playlist', playlistId)
}

export function encodeJamShare(hostId: string, hostName: string): string {
  return `${PREFIX}jam:${hostId}:${encodeURIComponent(hostName)}`
}

/** Detects any share token. Returns null for plain text or empty-id tokens. */
export function parseShare(body: string): ParsedShare | null {
  if (!body.startsWith(PREFIX)) return null
  const rest = body.slice(PREFIX.length)
  const sep = rest.indexOf(':')
  if (sep < 0) return null
  const kind = rest.slice(0, sep)
  const id = rest.slice(sep + 1).trim()
  if (!id) return null
  if (kind === 'jam') {
    const nameSep = id.indexOf(':')
    if (nameSep < 0) return null
    const hostId = id.slice(0, nameSep).trim()
    const encodedName = id.slice(nameSep + 1).trim()
    if (!hostId || !encodedName) return null
    try {
      return { kind, id: hostId, name: decodeURIComponent(encodedName) }
    } catch {
      return null
    }
  }
  if (kind !== 'track' && kind !== 'album' && kind !== 'playlist') return null
  return { kind, id }
}

/** Back-compat narrow helper: returns the track id only if this is a track share. */
export function parseTrackShare(body: string): { trackId: string } | null {
  const p = parseShare(body)
  return p && p.kind === 'track' ? { trackId: p.id } : null
}
