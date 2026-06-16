import { describe, it, expect, beforeEach } from 'vitest'
import { usePlayerStore } from './playerStore'
import { useAuthStore } from './authStore'

// isFreeUser() === (user.capabilities.unlimitedPlayback === false).
// A premium user has unlimitedPlayback: true; a free user has it false.
const setPlan = (free: boolean) =>
  useAuthStore.setState({ user: { capabilities: { unlimitedPlayback: !free } } as never })

beforeEach(() => {
  usePlayerStore.setState({ shuffleEnabled: false, repeatMode: 'off', queue: [], queueIndex: 0, currentTrack: null })
})

describe('playerStore free-tier gating', () => {
  it('keeps free users locked to shuffle (toggle off is a no-op)', () => {
    setPlan(true)
    usePlayerStore.setState({ shuffleEnabled: true })
    usePlayerStore.getState().toggleShuffle()
    expect(usePlayerStore.getState().shuffleEnabled).toBe(true)
  })

  it('does not let free users change repeat mode', () => {
    setPlan(true)
    usePlayerStore.getState().cycleRepeat()
    expect(usePlayerStore.getState().repeatMode).toBe('off')
  })

  it('lets premium users toggle shuffle on and off', () => {
    setPlan(false)
    usePlayerStore.setState({ shuffleEnabled: true })
    usePlayerStore.getState().toggleShuffle()
    expect(usePlayerStore.getState().shuffleEnabled).toBe(false)
    usePlayerStore.getState().toggleShuffle()
    expect(usePlayerStore.getState().shuffleEnabled).toBe(true)
  })

  it('cycles premium repeat off → all → one → off', () => {
    setPlan(false)
    const cycle = () => usePlayerStore.getState().cycleRepeat()
    cycle()
    expect(usePlayerStore.getState().repeatMode).toBe('all')
    cycle()
    expect(usePlayerStore.getState().repeatMode).toBe('one')
    cycle()
    expect(usePlayerStore.getState().repeatMode).toBe('off')
  })
})
