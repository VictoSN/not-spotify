import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Track } from '@/types/track'
import { usePlayerStore } from '@/stores/playerStore'
import { usePlaybackContext } from './usePlaybackContext'

const track = (id: string, albumId: string, artistId: string): Track =>
  ({
    id,
    title: `Track ${id}`,
    durationMs: 1000,
    artist: { id: artistId, name: 'Artist', imageUrl: null },
    album: { id: albumId, title: 'Album', coverUrl: '', releaseDate: '2020-01-01', type: 'album' },
  }) as unknown as Track

beforeEach(() => {
  usePlayerStore.setState({
    currentTrack: null,
    isPlaying: false,
    currentContextType: null,
    currentContextId: null,
  })
})

describe('usePlaybackContext', () => {
  it('an album lights up when the current track belongs to it', () => {
    usePlayerStore.setState({ currentTrack: track('t1', 'AL1', 'AR1'), isPlaying: true })
    const { result } = renderHook(() => usePlaybackContext({ type: 'album', id: 'AL1' }))
    expect(result.current.isActiveContext).toBe(true)
    expect(result.current.isPlayingContext).toBe(true)
  })

  it('shows active-but-paused (play icon) when the album is current but paused', () => {
    usePlayerStore.setState({ currentTrack: track('t1', 'AL1', 'AR1'), isPlaying: false })
    const { result } = renderHook(() => usePlaybackContext({ type: 'album', id: 'AL1' }))
    expect(result.current.isActiveContext).toBe(true)
    expect(result.current.isPlayingContext).toBe(false)
  })

  it('a different album is not active', () => {
    usePlayerStore.setState({ currentTrack: track('t1', 'AL1', 'AR1'), isPlaying: true })
    const { result } = renderHook(() => usePlaybackContext({ type: 'album', id: 'AL2' }))
    expect(result.current.isActiveContext).toBe(false)
    expect(result.current.isPlayingContext).toBe(false)
  })

  it('an album does not stay active from context when the current track moved to another album', () => {
    usePlayerStore.setState({
      currentTrack: track('t2', 'AL2', 'AR1'),
      isPlaying: true,
      currentContextType: 'album',
      currentContextId: 'AL1',
    })
    const { result } = renderHook(() => usePlaybackContext({ type: 'album', id: 'AL1' }))
    expect(result.current.isActiveContext).toBe(false)
    expect(result.current.isPlayingContext).toBe(false)
  })

  it('an album does not light up while an artist context is playing one of its tracks', () => {
    usePlayerStore.setState({
      currentTrack: track('t1', 'AL1', 'AR1'),
      isPlaying: true,
      currentContextType: 'artist',
      currentContextId: 'AR1',
    })
    const { result } = renderHook(() => usePlaybackContext({ type: 'album', id: 'AL1' }))
    expect(result.current.isActiveContext).toBe(false)
    expect(result.current.isPlayingContext).toBe(false)
  })

  it('an album does not light up while a mix context is playing one of its tracks', () => {
    usePlayerStore.setState({
      currentTrack: track('t1', 'AL1', 'AR1'),
      isPlaying: true,
      currentContextType: 'mix',
      currentContextId: 'MIX1',
    })
    const { result } = renderHook(() => usePlaybackContext({ type: 'album', id: 'AL1' }))
    expect(result.current.isActiveContext).toBe(false)
    expect(result.current.isPlayingContext).toBe(false)
  })

  it('an artist does not light up just because the current track is by that artist', () => {
    usePlayerStore.setState({
      currentTrack: track('t1', 'AL1', 'AR1'),
      isPlaying: true,
      currentContextType: 'album',
      currentContextId: 'AL1',
    })
    const { result } = renderHook(() => usePlaybackContext({ type: 'artist', id: 'AR1' }))
    expect(result.current.isActiveContext).toBe(false)
    expect(result.current.isPlayingContext).toBe(false)
  })

  it('an artist lights up only when it is the explicit playback context', () => {
    usePlayerStore.setState({
      currentTrack: track('t1', 'AL1', 'AR1'),
      isPlaying: true,
      currentContextType: 'artist',
      currentContextId: 'AR1',
    })
    const { result } = renderHook(() => usePlaybackContext({ type: 'artist', id: 'AR1' }))
    expect(result.current.isActiveContext).toBe(true)
    expect(result.current.isPlayingContext).toBe(true)
  })

  it('a playlist only matches the explicit context, not the track', () => {
    // Same track is playing, but seeded from a different surface → not this playlist.
    usePlayerStore.setState({
      currentTrack: track('t1', 'AL1', 'AR1'),
      isPlaying: true,
      currentContextType: 'album',
      currentContextId: 'AL1',
    })
    const { result } = renderHook(() => usePlaybackContext({ type: 'playlist', id: 'PL1' }))
    expect(result.current.isActiveContext).toBe(false)
  })

  it('a playlist lights up when it is the explicit playback context', () => {
    usePlayerStore.setState({
      currentTrack: track('t1', 'AL1', 'AR1'),
      isPlaying: true,
      currentContextType: 'playlist',
      currentContextId: 'PL1',
    })
    const { result } = renderHook(() => usePlaybackContext({ type: 'playlist', id: 'PL1' }))
    expect(result.current.isActiveContext).toBe(true)
    expect(result.current.isPlayingContext).toBe(true)
  })

  it('a mix only lights up when it is the explicit playback context', () => {
    usePlayerStore.setState({
      currentTrack: track('t1', 'AL1', 'AR1'),
      isPlaying: true,
      currentContextType: 'mix',
      currentContextId: 'MIX1',
    })
    const activeMix = renderHook(() => usePlaybackContext({ type: 'mix', id: 'MIX1' }))
    expect(activeMix.result.current.isActiveContext).toBe(true)
    expect(activeMix.result.current.isPlayingContext).toBe(true)

    const otherMixWithSameTrack = renderHook(() => usePlaybackContext({ type: 'mix', id: 'MIX2' }))
    expect(otherMixWithSameTrack.result.current.isActiveContext).toBe(false)
    expect(otherMixWithSameTrack.result.current.isPlayingContext).toBe(false)
  })

  it('returns inactive for a null context', () => {
    usePlayerStore.setState({ currentTrack: track('t1', 'AL1', 'AR1'), isPlaying: true })
    const { result } = renderHook(() => usePlaybackContext(null))
    expect(result.current.isActiveContext).toBe(false)
  })
})
