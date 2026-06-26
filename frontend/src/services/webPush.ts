/**
 * Web Push subscription helpers. Talks to the backend's /push endpoints and
 * the browser's PushManager. The service worker (public/sw.js) handles the
 * `push` event and shows the OS notification — this module just manages the
 * subscription lifecycle from the page.
 */

import { api } from './api'

const VAPID_CACHE_KEY = 'ns-push-vapid-public'
const SUB_CACHE_KEY = 'ns-push-subscribed'

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  // VAPID public keys arrive as URL-safe base64 without padding.
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const cached = localStorage.getItem(VAPID_CACHE_KEY)
    if (cached) return cached
  } catch { /* ignore */ }
  try {
    const res = await api.get<{ publicKey: string }>('/push/vapid-public-key')
    const key = res.data.publicKey
    try { localStorage.setItem(VAPID_CACHE_KEY, key) } catch { /* ignore */ }
    return key
  } catch {
    return null
  }
}

function arrayBufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return ''
  const bytes = new Uint8Array(buf)
  let str = ''
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i])
  return btoa(str)
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false
  const reg = await getRegistration()
  if (!reg) return false
  const sub = await reg.pushManager.getSubscription()
  return sub !== null
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false
  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return false
  }
  if (Notification.permission !== 'granted') return false

  const reg = await getRegistration()
  if (!reg) return false

  const vapid = await getVapidPublicKey()
  if (!vapid) return false

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    // PushManager.subscribe wants BufferSource<ArrayBuffer> — Uint8Array<ArrayBufferLike>
    // from Uint8Array() trips strict TS even though it's correct at runtime.
    const keyBytes = urlBase64ToUint8Array(vapid)
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes.buffer as ArrayBuffer,
    })
  }

  const payload = {
    endpoint: sub.endpoint,
    p256dh: arrayBufferToBase64(sub.getKey('p256dh')),
    authSecret: arrayBufferToBase64(sub.getKey('auth')),
  }
  await api.post('/push/subscribe', payload)
  try { localStorage.setItem(SUB_CACHE_KEY, 'true') } catch { /* ignore */ }
  return true
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return
  const reg = await getRegistration()
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  try {
    await api.post('/push/unsubscribe', { endpoint: sub.endpoint })
  } catch { /* server may be down — still drop locally */ }
  try { await sub.unsubscribe() } catch { /* ignore */ }
  try { localStorage.removeItem(SUB_CACHE_KEY) } catch { /* ignore */ }
}

/** POST /push/test — fires a real Web Push from the server to confirm the loop. */
export async function sendPushTest(): Promise<void> {
  await api.post('/push/test')
}
