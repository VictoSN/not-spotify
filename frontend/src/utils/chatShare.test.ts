import { describe, it, expect } from 'vitest'
import {
  encodeAlbumShare,
  encodeJamShare,
  encodePlaylistShare,
  encodeTrackShare,
  parseShare,
  parseTrackShare,
} from './chatShare'

describe('chatShare', () => {
  it('round-trips a track id through encode → parse', () => {
    const encoded = encodeTrackShare('track-123')
    expect(encoded).toBe('ns:share:track:track-123')
    expect(parseTrackShare(encoded)).toEqual({ trackId: 'track-123' })
    expect(parseShare(encoded)).toEqual({ kind: 'track', id: 'track-123' })
  })

  it('round-trips an album id through encode → parse', () => {
    const encoded = encodeAlbumShare('album-9')
    expect(encoded).toBe('ns:share:album:album-9')
    expect(parseShare(encoded)).toEqual({ kind: 'album', id: 'album-9' })
    expect(parseTrackShare(encoded)).toBeNull()
  })

  it('round-trips a playlist id through encode → parse', () => {
    const encoded = encodePlaylistShare('pl-42')
    expect(encoded).toBe('ns:share:playlist:pl-42')
    expect(parseShare(encoded)).toEqual({ kind: 'playlist', id: 'pl-42' })
  })

  it('round-trips a Jam invite through encode → parse', () => {
    const encoded = encodeJamShare('host-1', 'Alex Rivera')
    expect(parseShare(encoded)).toEqual({ kind: 'jam', id: 'host-1', name: 'Alex Rivera' })
  })

  it('returns null for a plain text message', () => {
    expect(parseShare('hey, listen to this!')).toBeNull()
    expect(parseTrackShare('hey, listen to this!')).toBeNull()
    expect(parseShare('')).toBeNull()
  })

  it('returns null when the token has no id', () => {
    expect(parseShare('ns:share:track:')).toBeNull()
    expect(parseShare('ns:share:album:   ')).toBeNull()
    expect(parseShare('ns:share:playlist:')).toBeNull()
  })

  it('returns null for an unknown kind', () => {
    expect(parseShare('ns:share:artist:abc')).toBeNull()
  })
})
