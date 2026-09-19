/* Flashlight Pro™ — Service Worker
   Cache-first for the app shell so the app
   loads offline and satisfies PWA install criteria.
*/
const CACHE = 'flashlight-pro-v2'

// On install: cache the app shell
self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/icon-192.svg',
        '/icon-512.svg',
        '/apple-touch-icon.svg',
      ])
    )
  )
})

// On activate: claim clients and remove stale caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// Fetch: cache-first for navigation + same-origin assets, network-first for everything else
self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return

  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        // Cache successful GET responses for the app shell
        if (request.method === 'GET' && response.ok) {
          const clone = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, clone))
        }
        return response
      }).catch(() => {
        // Offline fallback: return cached index.html for navigation
        if (request.mode === 'navigate') {
          return caches.match('/index.html')
        }
      })
    })
  )
})
