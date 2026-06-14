/*
 * not-spotify service worker.
 *
 * Scope of offline support (intentionally conservative):
 *  - App shell + same-origin build assets (JS/CSS/fonts) and images are cached
 *    so the installed app loads and renders without a network connection.
 *  - Navigations are network-first with an offline fallback to the cached shell.
 *  - API requests (backend) and audio/video are NEVER cached here: API responses
 *    are auth-scoped and must stay fresh, and audio is fetched with HTTP Range
 *    requests whose 206 partials break seeking if naively cached. True offline
 *    playback of downloaded tracks is a deliberate follow-up (needs a dedicated
 *    "save for offline" store with full-file caching + Range replay).
 *
 * Bump CACHE_VERSION whenever the precache list or strategy changes.
 */
const CACHE_VERSION = 'v1'
const SHELL_CACHE = `ns-shell-${CACHE_VERSION}`
const ASSET_CACHE = `ns-assets-${CACHE_VERSION}`

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {}) // a missing optional asset must not block install
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// Let the page trigger an immediate activation after an update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

function isApiRequest(url) {
  // Backend lives on a different origin/port; treat any cross-origin call that
  // isn't a static asset as "do not cache" by default below. This also catches
  // a same-origin "/api" prefix if the app is ever served behind a proxy.
  return url.pathname.startsWith('/api/')
}

async function networkFirstShell(request) {
  try {
    const fresh = await fetch(request)
    // Cache successful navigations so deep links work offline next time.
    if (fresh && fresh.ok) {
      const cache = await caches.open(SHELL_CACHE)
      cache.put(request, fresh.clone()).catch(() => {})
    }
    return fresh
  } catch {
    return (
      (await caches.match(request)) ||
      (await caches.match('/index.html')) ||
      (await caches.match('/')) ||
      Response.error()
    )
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      // Cache same-origin OK responses and cross-origin opaque ones (e.g. cover
      // art from Supabase) so artwork survives offline.
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone()).catch(() => {})
      }
      return response
    })
    .catch(() => undefined)
  return cached || (await network) || Response.error()
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // Navigations → network-first, offline fallback to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request))
    return
  }

  // Never intercept audio/video (Range requests) or API traffic.
  if (request.destination === 'audio' || request.destination === 'video') return
  if (isApiRequest(url)) return

  // Static assets + images → stale-while-revalidate for instant repeat loads.
  const cacheable =
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image'
  if (cacheable) {
    event.respondWith(staleWhileRevalidate(request))
  }
})
