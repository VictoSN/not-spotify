import { useEffect } from 'react'
import { independentSiteUrl, type IndependentSite } from '@/utils/independentSites'

const SCOPE = 'not-spotify-auth-session'
const STORAGE_KEY = 'ns-auth-session-event'
const SITES: IndependentSite[] = ['account', 'support', 'download']

type SessionEvent = 'login' | 'logout'

interface SessionPayload {
  id: string
  event: SessionEvent
  timestamp: number
}

function allowedParentOrigins() {
  return new Set([
    window.location.origin,
    ...SITES.map((site) => new URL(independentSiteUrl(site)).origin),
  ])
}

/**
 * Hidden main-origin relay used by every app subdomain. The iframes share this
 * origin's localStorage, so its storage event becomes a safe cross-subdomain
 * signal without exposing the HTTP-only refresh cookie to JavaScript.
 */
export function AuthSessionBridgePage() {
  useEffect(() => {
    const allowedOrigins = allowedParentOrigins()
    let parent: { source: Window; origin: string } | null = null

    const onMessage = (message: MessageEvent) => {
      const data = message.data as { scope?: string; kind?: string; payload?: SessionPayload }
      if (data?.scope !== SCOPE || !allowedOrigins.has(message.origin) || !message.source) return

      if (data.kind === 'register') {
        parent = { source: message.source as Window, origin: message.origin }
        parent.source.postMessage({ scope: SCOPE, kind: 'ready' }, parent.origin)
        return
      }

      if (data.kind !== 'publish' || !data.payload || message.source !== parent?.source) return

      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data.payload))
      } catch {
        // A storage-disabled browser still receives the acknowledgement; the
        // originating tab can complete its own login/logout normally.
      }
      parent.source.postMessage({ scope: SCOPE, kind: 'ack', id: data.payload.id }, parent.origin)
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue || !parent) return
      try {
        const payload = JSON.parse(event.newValue) as SessionPayload
        if (payload.event !== 'login' && payload.event !== 'logout') return
        parent.source.postMessage({ scope: SCOPE, kind: 'event', payload }, parent.origin)
      } catch {
        /* ignore malformed/stale storage values */
      }
    }

    window.addEventListener('message', onMessage)
    window.addEventListener('storage', onStorage)
    // Announce only after the listener exists; the parent's iframe `load`
    // event can otherwise beat React's effect and lose the first register.
    window.parent.postMessage({ scope: SCOPE, kind: 'loaded' }, '*')
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return null
}
