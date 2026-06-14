/*
 * not-spotify service worker.
 *
 * Scope of offline support (intentionally conservative):
 *  - App shell + same-origin build assets (JS/CSS/fonts) and images are cached
 *    so the installed app loads and renders without a network connection.
 *  - Navigations are network-first with an offline fallback to the cached shell.
 *  - API requests (backend) and *streaming* audio/video are NEVER cached here:
 *    API responses are auth-scoped and must stay fresh, and live audio is
 *    fetched with HTTP Range requests whose 206 partials break seeking if
 *    naively cached. Normal playback is therefore completely untouched.
 *  - "Save for offline" (premium) is the one exception: the page stores a full
 *    audio file in OFFLINE_CACHE and plays it back via the dedicated same-origin
 *    path "/_offline-audio?id=<trackId>". Only that path is intercepted, and
 *    this SW reconstructs Range (206) responses from the cached full body so
 *    seeking works offline. See services/offlineAudio.ts on the page side.
 *
 * Bump CACHE_VERSION whenever the precache list or strategy changes.
 * OFFLINE_CACHE is intentionally NOT versioned so saved tracks survive updates.
 */
const CACHE_VERSION = 'v1'
const SHELL_CACHE = `ns-shell-${CACHE_VERSION}`
const ASSET_CACHE = `ns-assets-${CACHE_VERSION}`
const OFFLINE_CACHE = 'ns-offline-audio'
// Keyed entries inside OFFLINE_CACHE live under this path prefix.
const OFFLINE_DATA_PREFIX = '/_offline-audio-data/'
const OFFLINE_PLAY_PATH = '/_offline-audio'

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
            .filter(
              (k) => k !== SHELL_CACHE && k !== ASSET_CACHE && k !== OFFLINE_CACHE,
            )
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

// Serve a saved track from OFFLINE_CACHE, reconstructing a 206 partial from the
// cached full body when the media element sends a Range header (so seeking works
// offline). Returns 404 when the track isn't saved.
async function serveOfflineAudio(url, request) {
  const id = url.searchParams.get('id')
  if (!id) return new Response('Missing id', { status: 400 })

  const cache = await caches.open(OFFLINE_CACHE)
  const cached = await cache.match(OFFLINE_DATA_PREFIX + id)
  if (!cached) return new Response('Not saved offline', { status: 404 })

  const contentType = cached.headers.get('Content-Type') || 'audio/mpeg'
  const range = request.headers.get('Range') || request.headers.get('range')

  if (!range) {
    const buf = await cached.arrayBuffer()
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buf.byteLength),
        'Accept-Ranges': 'bytes',
      },
    })
  }

  const buf = await cached.arrayBuffer()
  const total = buf.byteLength
  const match = /bytes=(\d*)-(\d*)/.exec(range)
  let start = match && match[1] ? parseInt(match[1], 10) : 0
  let end = match && match[2] ? parseInt(match[2], 10) : total - 1
  if (Number.isNaN(start) || start < 0) start = 0
  if (Number.isNaN(end) || end >= total) end = total - 1
  if (start > end) {
    return new Response('Range Not Satisfiable', {
      status: 416,
      headers: { 'Content-Range': `bytes */${total}` },
    })
  }

  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  })
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

  // Saved-for-offline playback: only this dedicated same-origin path is
  // intercepted for audio — normal streaming audio (below) is never touched.
  if (url.origin === self.location.origin && url.pathname === OFFLINE_PLAY_PATH) {
    event.respondWith(serveOfflineAudio(url, request))
    return
  }

  // Navigations → network-first, offline fallback to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request))
    return
  }

  // Never intercept streaming audio/video (Range requests) or API traffic.
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
