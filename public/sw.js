/* Our Cycle service worker — privacy-preserving app-shell cache.
   - Immutable static assets: cache-first.
   - Navigations: network-first (always fresh when online), /offline as safe fallback.
   - Sensitive authenticated health data (RSC streams, HTML payloads, API responses)
     are NEVER persisted in CacheStorage to protect privacy on shared/offline devices.
   - Day-log writes made offline are queued client-side and replayed on reconnect. */

const VERSION = 'our-cycle-v1.2'
const APP_SHELL = [
  '/offline',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return // writes always hit the network
  const url = new URL(req.url)
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return // never cache API responses

  // Navigation requests: always fetch live so sensitive reproductive data is never cached in CacheStorage
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/offline')),
    )
    return
  }

  // Static immutable assets & icons
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone()
            caches.open(VERSION).then((cache) => cache.put(req, copy))
            return res
          }),
      ),
    )
  }
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting()
  }
  if (event.data && event.data.action === 'clearCache') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  }
})
