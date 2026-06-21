import { describe, it, expect, beforeEach } from 'vitest'
import {
  getPinnedKeys,
  isPinned,
  togglePinned,
  PINNED_STORAGE_KEY,
  PINNED_EVENT,
} from './pinnedLibrary'

beforeEach(() => window.localStorage.clear())

describe('pinnedLibrary', () => {
  it('starts empty', () => {
    expect(getPinnedKeys()).toEqual([])
    expect(isPinned('pl-1')).toBe(false)
  })

  it('toggles a key on and off, returning the new state', () => {
    expect(togglePinned('pl-1')).toBe(true)
    expect(isPinned('pl-1')).toBe(true)
    expect(getPinnedKeys()).toEqual(['pl-1'])

    expect(togglePinned('pl-1')).toBe(false)
    expect(isPinned('pl-1')).toBe(false)
    expect(getPinnedKeys()).toEqual([])
  })

  it('puts the most-recently pinned key first', () => {
    togglePinned('pl-1')
    togglePinned('al-2')
    expect(getPinnedKeys()).toEqual(['al-2', 'pl-1'])
  })

  it('dispatches PINNED_EVENT on change', () => {
    let fired = 0
    const handler = () => { fired++ }
    window.addEventListener(PINNED_EVENT, handler)
    togglePinned('ar-9')
    window.removeEventListener(PINNED_EVENT, handler)
    expect(fired).toBe(1)
  })

  it('ignores corrupt storage', () => {
    window.localStorage.setItem(PINNED_STORAGE_KEY, 'not json')
    expect(getPinnedKeys()).toEqual([])
  })
})
