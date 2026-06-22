import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Track } from '@/types/track'

// libraryStore is consumed via getState() in the 'l' handler — mock it so we can
// observe like/unlike without the real store + API.
const likeTrack = vi.fn()
const unlikeTrack = vi.fn()
let likedTrackIds = new Set<string>()
vi.mock('@/stores/libraryStore', () => ({
  useLibraryStore: { getState: () => ({ likeTrack, unlikeTrack, likedTrackIds }) },
}))

import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'

const fakeTrack = { id: 't1', title: 'T', artist: { id: 'a1' } } as unknown as Track

const spies = {
  togglePlayPause: vi.fn(),
  seek: vi.fn(),
  skipNext: vi.fn(),
  skipPrevious: vi.fn(),
  setVolume: vi.fn(),
  toggleMute: vi.fn(),
}

let unmount: () => void

function press(key: string, opts: Partial<KeyboardEventInit> & { on?: HTMLElement } = {}) {
  const { on, ...init } = opts
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  ;(on ?? window).dispatchEvent(ev)
  return ev
}

beforeEach(() => {
  vi.clearAllMocks()
  likedTrackIds = new Set<string>()
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'me' } as never })
  usePlayerStore.setState({
    ...spies,
    currentTrack: fakeTrack,
    currentTime: 20,
    duration: 200,
    volume: 0.5,
  })
  unmount = renderHook(() => useKeyboardShortcuts()).unmount
})

afterEach(() => unmount?.())

describe('useKeyboardShortcuts', () => {
  it('Space toggles play/pause and prevents the default scroll', () => {
    const ev = press(' ')
    expect(spies.togglePlayPause).toHaveBeenCalledTimes(1)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('ArrowRight/Left seek ±5s; with Ctrl/Cmd they skip tracks', () => {
    press('ArrowRight')
    expect(spies.seek).toHaveBeenLastCalledWith(25)
    press('ArrowLeft')
    expect(spies.seek).toHaveBeenLastCalledWith(15)

    press('ArrowRight', { ctrlKey: true })
    expect(spies.skipNext).toHaveBeenCalledTimes(1)
    press('ArrowLeft', { metaKey: true })
    expect(spies.skipPrevious).toHaveBeenCalledTimes(1)
  })

  it('Shift+Arrow Up/Down nudge the volume; without Shift they do nothing', () => {
    press('ArrowUp', { shiftKey: true })
    expect(spies.setVolume).toHaveBeenLastCalledWith(expect.closeTo(0.6))
    press('ArrowDown', { shiftKey: true })
    expect(spies.setVolume).toHaveBeenLastCalledWith(expect.closeTo(0.4))

    spies.setVolume.mockClear()
    press('ArrowUp') // no shift
    expect(spies.setVolume).not.toHaveBeenCalled()
  })

  it('M toggles mute; L likes/unlikes the current track', () => {
    press('m')
    expect(spies.toggleMute).toHaveBeenCalledTimes(1)

    press('l')
    expect(likeTrack).toHaveBeenCalledWith(fakeTrack)

    likedTrackIds = new Set(['t1'])
    press('l')
    expect(unlikeTrack).toHaveBeenCalledWith('t1')
  })

  it('leaves Space alone when a button is focused (so it activates the button)', () => {
    const btn = document.createElement('button')
    document.body.appendChild(btn)
    press(' ', { on: btn })
    expect(spies.togglePlayPause).not.toHaveBeenCalled()
    btn.remove()
  })

  it('ignores shortcuts while typing in an input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    press(' ', { on: input })
    press('ArrowRight', { on: input })
    expect(spies.togglePlayPause).not.toHaveBeenCalled()
    expect(spies.seek).not.toHaveBeenCalled()
    input.remove()
  })

  it('does nothing when no track is loaded', () => {
    usePlayerStore.setState({ currentTrack: null })
    press(' ')
    press('ArrowRight')
    expect(spies.togglePlayPause).not.toHaveBeenCalled()
    expect(spies.seek).not.toHaveBeenCalled()
  })

  it('L does not like when unauthenticated', () => {
    useAuthStore.setState({ isAuthenticated: false, user: null })
    press('l')
    expect(likeTrack).not.toHaveBeenCalled()
  })
})
