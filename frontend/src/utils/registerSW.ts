// Registers the PWA service worker. Kept tiny and side-effect-isolated so it can
// be called once from main.tsx. The SW itself (public/sw.js) handles caching;
// here we only register it and surface updates without forcing a reload loop.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  // Never run the caching SW in dev — it would cache Vite HMR modules and break
  // hot reload. Only register for the built (production) app.
  if (!import.meta.env.PROD) {
    // Defensive cleanup: a SW left over from a prior `npm run preview` keeps
    // intercepting localhost and serves its stale PROD bundle (whose hashed
    // chunks the dev server doesn't have) → a blank white screen. Unregister any
    // leftover SW + drop its caches so `dev` runs clean after `preview`.
    navigator.serviceWorker.getRegistrations?.()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {})
    window.caches?.keys?.()
      .then((keys) => keys.forEach((k) => caches.delete(k)))
      .catch(() => {})
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
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
              // A fresh version is ready; it takes over on the next load.
              installing.postMessage?.('SKIP_WAITING')
            }
          })
        })
      })
      .catch(() => {
        // Registration failures are non-fatal — the app still works online.
      })
  })
}
