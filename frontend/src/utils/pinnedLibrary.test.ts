import { describe, it, expect, beforeEach } from 'vitest'
import {
  getPinnedKeys,
  isPinned,
  togglePinned,
  PINNED_STORAGE_KEY,
  PINNED_EVENT,
} from './pinnedLibrary'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/user'

const fakeUser = (id: string): User =>
  ({ id, name: id, email: `${id}@x.test`, plan: 'free', roles: [] }) as unknown as User

beforeEach(() => {
  window.localStorage.clear()
  useAuthStore.setState({ user: null, isAuthenticated: false })
})

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

  it('scopes pins per account so they do not leak across logins', () => {
    useAuthStore.setState({ user: fakeUser('alice'), isAuthenticated: true })
    togglePinned('pl-1')
    expect(getPinnedKeys()).toEqual(['pl-1'])

    // A different account on the same browser sees its own (empty) pins.
    useAuthStore.setState({ user: fakeUser('bob'), isAuthenticated: true })
    expect(getPinnedKeys()).toEqual([])
    togglePinned('al-2')
    expect(getPinnedKeys()).toEqual(['al-2'])

    // Switching back restores the original account's pins untouched.
    useAuthStore.setState({ user: fakeUser('alice'), isAuthenticated: true })
    expect(getPinnedKeys()).toEqual(['pl-1'])
  })
})
