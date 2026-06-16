import { describe, it, expect } from 'vitest'
import { encodeTrackShare, parseTrackShare } from './chatShare'

describe('chatShare', () => {
  it('round-trips a track id through encode → parse', () => {
    const encoded = encodeTrackShare('track-123')
    expect(encoded).toBe('ns:share:track:track-123')
    expect(parseTrackShare(encoded)).toEqual({ trackId: 'track-123' })
  })

  it('returns null for a plain text message', () => {
    expect(parseTrackShare('hey, listen to this!')).toBeNull()
    expect(parseTrackShare('')).toBeNull()
  })

  it('returns null when the token has no id', () => {
    expect(parseTrackShare('ns:share:track:')).toBeNull()
    expect(parseTrackShare('ns:share:track:   ')).toBeNull()
  })
})
