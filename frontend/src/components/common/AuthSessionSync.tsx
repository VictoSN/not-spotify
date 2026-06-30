import { useEffect, useMemo, useRef } from 'react'
import { mainAppUrl } from '@/utils/independentSites'

const SCOPE = 'not-spotify-auth-session'
const READY_EVENT = 'ns-auth-bridge-ready'

export type AuthSessionEvent = 'login' | 'logout'

interface SessionPayload {
  id: string
  event: AuthSessionEvent
  timestamp: number
}

function sessionBridge() {
  return document.querySelector<HTMLIFrameElement>('iframe[data-auth-session-bridge]')
}

async function readySessionBridge() {
  const current = sessionBridge()
  if (!current) return null
  if (current?.dataset.ready === 'true' && current.contentWindow) return current

  return new Promise<HTMLIFrameElement | null>((resolve) => {
    const finish = () => {
      window.clearTimeout(timeout)
      resolve(sessionBridge())
    }
    const timeout = window.setTimeout(() => {
      window.removeEventListener(READY_EVENT, finish)
      resolve(null)
    }, 1500)
    window.addEventListener(READY_EVENT, finish, { once: true })
  })
}

export async function publishAuthSessionEvent(event: AuthSessionEvent) {
  const frame = await readySessionBridge()
  if (!frame?.contentWindow) return false

  const targetWindow = frame.contentWindow
  const targetOrigin = new URL(frame.src).origin
  const payload: SessionPayload = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    event,
    timestamp: Date.now(),
  }

  return new Promise<boolean>((resolve) => {
    const finish = (published: boolean) => {
      window.clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
      resolve(published)
    }
    const onMessage = (message: MessageEvent) => {
      const data = message.data as { scope?: string; kind?: string; id?: string }
      if (
        message.source === targetWindow
        && message.origin === targetOrigin
        && data?.scope === SCOPE
        && data.kind === 'ack'
        && data.id === payload.id
      ) finish(true)
    }
    const timeout = window.setTimeout(() => finish(false), 1500)
    window.addEventListener('message', onMessage)
    targetWindow.postMessage({ scope: SCOPE, kind: 'publish', payload }, targetOrigin)
  })
}

export function AuthSessionSync({ onEvent }: { onEvent: (event: AuthSessionEvent) => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const source = useMemo(() => mainAppUrl('/auth/session-bridge'), [])
  const sourceOrigin = useMemo(() => new URL(source, window.location.href).origin, [source])

  useEffect(() => {
    const onMessage = (message: MessageEvent) => {
      if (message.source !== frameRef.current?.contentWindow || message.origin !== sourceOrigin) return
      const data = message.data as { scope?: string; kind?: string; payload?: SessionPayload }
      if (data?.scope !== SCOPE) return

      if (data.kind === 'loaded') {
        frameRef.current?.contentWindow?.postMessage({ scope: SCOPE, kind: 'register' }, sourceOrigin)
      } else if (data.kind === 'ready') {
        if (frameRef.current) frameRef.current.dataset.ready = 'true'
        window.dispatchEvent(new Event(READY_EVENT))
      } else if (data.kind === 'event' && data.payload) {
        onEvent(data.payload.event)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onEvent, sourceOrigin])

  return (
    <iframe
      ref={frameRef}
      src={source}
      title="Session synchronization"
      aria-hidden="true"
      tabIndex={-1}
      data-auth-session-bridge
      className="hidden"
      onLoad={() => frameRef.current?.contentWindow?.postMessage({ scope: SCOPE, kind: 'register' }, sourceOrigin)}
    />
  )
}
