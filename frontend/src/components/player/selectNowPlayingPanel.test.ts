import { describe, it, expect } from 'vitest'
import { selectNowPlayingPanel } from './selectNowPlayingPanel'

describe('selectNowPlayingPanel', () => {
  it('chooses the dedicated music-video panel when playbackMode is video', () => {
    expect(selectNowPlayingPanel('video')).toBe('video')
  })

  it('chooses the audio NowPlayingPanel for audio playback', () => {
    expect(selectNowPlayingPanel('audio')).toBe('audio')
  })
})
