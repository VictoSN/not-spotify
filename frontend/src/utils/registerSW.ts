// Registers the PWA service worker. In production it runs the full caching
// strategy. In dev it registers `?mode=dev`, which makes sw.js skip its fetch
// handler — Vite HMR stays untouched, but the push + notificationclick
// handlers are still installed so Web Push works during development.
//
// Kept tiny and side-effect-isolated so it can be called once from main.tsx.
let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null

export function serviceWorkerUrl() {
  return import.meta.env.PROD ? '/sw.js' : '/sw.js?mode=dev'
}

export function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null)
  if (registrationPromise) return registrationPromise

  const isDev = !import.meta.env.PROD
  const swUrl = serviceWorkerUrl()

  // One-time cleanup: an older non-dev-aware SW left over from a prior
  // `npm run preview` would still intercept module URLs and white-screen
  // the page even after this code runs, because that SW is *already
  // controlling* the page on this load. Detect a controller registered
  // against the old URL (no ?mode=dev) and force a single reload so we
  // come back uncontrolled and pick up the right SW.
  if (isDev && navigator.serviceWorker.controller) {
    const ctrlUrl = navigator.serviceWorker.controller.scriptURL
    if (!ctrlUrl.includes('mode=dev')) {
      const RELOAD_FLAG = 'ns-sw-dev-reloaded'
      if (!sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, '1')
        void Promise.allSettled([
          navigator.serviceWorker.getRegistrations?.()
            .then((regs) => Promise.all(regs.map((r) => r.unregister()))) ??
            Promise.resolve(),
          window.caches?.keys?.()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k)))) ??
            Promise.resolve(),
        ]).finally(() => window.location.reload())
        return Promise.resolve(null)
      }
    } else {
      sessionStorage.removeItem('ns-sw-dev-reloaded')
    }
  }

  registrationPromise = navigator.serviceWorker
    .register(swUrl, { scope: '/' })
    .then((registration) => {
        // When a new SW is found, let it activate; it claims clients on the next
        // navigation. We deliberately don't auto-reload to avoid disrupting
        // playback mid-session.
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              installing.postMessage?.('SKIP_WAITING')
            }
          })
        })
      return registration
    })
    .catch(() => {
        // Registration failures are non-fatal — the app still works online.
      return null
    })

  return registrationPromise
}

export function registerServiceWorker() {
  window.addEventListener('load', () => {
    void ensureServiceWorkerRegistration()
  })
}
