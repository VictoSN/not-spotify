import React, { act } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthSessionSync } from './AuthSessionSync'
import { AuthSessionBridgePage } from '@/pages/AuthSessionBridgePage'

const scope = 'not-spotify-auth-session'

describe('cross-subdomain auth session relay', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('registers the hidden main-origin iframe and receives remote session events', () => {
    const onEvent = vi.fn()
    render(<AuthSessionSync onEvent={onEvent} />)

    const frame = screen.getByTitle('Session synchronization') as HTMLIFrameElement
    const target = frame.contentWindow!
    const postMessage = vi.spyOn(target, 'postMessage')

    fireEvent.load(frame)
    expect(postMessage).toHaveBeenCalledWith({ scope, kind: 'register' }, 'http://localhost:3000')

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        source: target,
        origin: 'http://localhost:3000',
        data: { scope, kind: 'ready' },
      }))
    })
    expect(frame.dataset.ready).toBe('true')

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        source: target,
        origin: 'http://localhost:3000',
        data: {
          scope,
          kind: 'event',
          payload: { id: 'remote-logout', event: 'logout', timestamp: Date.now() },
        },
      }))
    })
    expect(onEvent).toHaveBeenCalledWith('logout')
  })

  it('relays a published event through shared main-origin storage', () => {
    render(<AuthSessionBridgePage />)
    const parentPostMessage = vi.fn()
    const parentSource = { postMessage: parentPostMessage } as unknown as Window

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        source: parentSource,
        origin: 'http://support.localhost:3000',
        data: { scope, kind: 'register' },
      }))
    })
    expect(parentPostMessage).toHaveBeenCalledWith(
      { scope, kind: 'ready' },
      'http://support.localhost:3000',
    )

    const payload = { id: 'logout-1', event: 'logout', timestamp: Date.now() }
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        source: parentSource,
        origin: 'http://support.localhost:3000',
        data: { scope, kind: 'publish', payload },
      }))
    })

    expect(JSON.parse(window.localStorage.getItem('ns-auth-session-event')!)).toEqual(payload)
    expect(parentPostMessage).toHaveBeenCalledWith(
      { scope, kind: 'ack', id: payload.id },
      'http://support.localhost:3000',
    )

    const remotePayload = { id: 'login-2', event: 'login', timestamp: Date.now() }
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'ns-auth-session-event',
        newValue: JSON.stringify(remotePayload),
      }))
    })
    expect(parentPostMessage).toHaveBeenCalledWith(
      { scope, kind: 'event', payload: remotePayload },
      'http://support.localhost:3000',
    )
  })
})
