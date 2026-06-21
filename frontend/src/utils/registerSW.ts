// Registers the PWA service worker. Kept tiny and side-effect-isolated so it can
// be called once from main.tsx. The SW itself (public/sw.js) handles caching;
// here we only register it and surface updates without forcing a reload loop.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  // Never run the caching SW in dev — it would cache Vite HMR modules and break
  // hot reload. Only register for the built (production) app.
  if (!import.meta.env.PROD) {
    // Defensive cleanup: a SW left over from a prior `npm run preview` keeps
    // intercepting localhost and serving stale cached bytes for module URLs
    // (e.g. a cached image returned for `/src/.../*.tsx`, which the browser
    // rejects as a bad MIME type) → a blank white screen. Unregister any
    // leftover SW + drop its caches so `dev` runs clean after `preview`.
    //
    // Crucially, `unregister()`/`caches.delete()` do NOT stop the SW that is
    // already CONTROLLING the current page — it keeps intercepting for this
    // whole load. So when we detect a controller in dev, we clean up and then
    // force a single reload (guarded against a loop) to come back uncontrolled.
    const hadController = !!navigator.serviceWorker.controller
    Promise.allSettled([
      navigator.serviceWorker.getRegistrations?.()
        .then((regs) => Promise.all(regs.map((r) => r.unregister()))) ??
        Promise.resolve(),
      window.caches?.keys?.()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k)))) ??
        Promise.resolve(),
    ]).finally(() => {
      const RELOAD_FLAG = 'ns-sw-dev-reloaded'
      if (hadController && !sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, '1')
        window.location.reload()
      } else if (!hadController) {
        // Clean load — clear the guard so a future stale SW can self-heal again.
        sessionStorage.removeItem(RELOAD_FLAG)
      }
    })
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
