/**
 * Solo Leveling | GATE Tracker Pro - Service Worker
 * Version: 2.0.0
 * Provides offline navigation, authenticated app caching, and background sync triggers.
 */

const CACHE_NAME = 'gate-tracker-cache-v2'
const STATIC_ASSETS = [
  '/manifest.json',
  '/manifest.webmanifest',
  '/offline.html',
  '/favicon.ico',
  '/icons/icon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
]

// 1. Install Event: Pre-cache core shell & offline page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.warn('[SW] Some initial assets failed to cache:', err)
        })
      })
      .then(() => self.skipWaiting())
  )
})

// 2. Activate Event: Clean up outdated caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', name)
              return caches.delete(name)
            }
          })
        )
      })
      .then(() => self.clients.claim())
  )
})

// 3. Fetch Event: Smart routing & caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET') {
    return
  }

  // Never cache Supabase API, auth callbacks, or backend /api routes
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/')
  ) {
    return
  }

  // Navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache authenticated dashboard responses - NEVER cache login/signin redirects under '/'
          if (
            response &&
            response.status === 200 &&
            !response.redirected &&
            !response.url.includes('/signin') &&
            !response.url.includes('/sign-up')
          ) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
              if (url.pathname === '/') {
                cache.put('/', responseClone.clone())
              }
            })
          }
          return response
        })
        .catch(async () => {
          // When offline, serve cached dashboard or offline page
          // Never redirect to signin when offline
          const cachedHome = await caches.match('/')
          if (cachedHome && !cachedHome.url.includes('/signin')) {
            return cachedHome
          }

          const cachedPage = await caches.match(request)
          if (cachedPage && !cachedPage.url.includes('/signin')) {
            return cachedPage
          }

          // If completely offline and no cached dashboard, show offline chamber
          const fallback = await caches.match('/offline.html')
          return (
            fallback ||
            new Response('Offline Mode Active', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          )
        })
    )
    return
  }

  // Next.js RSC (React Server Components) payload requests
  if (url.searchParams.has('_rsc')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          return new Response('', {
            status: 200,
            headers: { 'Content-Type': 'text/x-component' },
          })
        })
    )
    return
  }

  // Next.js Static Chunks, CSS, fonts, and images (Stale-While-Revalidate)
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.ico')

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
            }
            return networkResponse
          })
          .catch(() => cached)

        return cached || fetchPromise
      })
    )
    return
  }

  // Default: Network with Cache Fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})

// 4. Background Sync Event (Standard Web Background Sync API)
self.addEventListener('sync', (event) => {
  if (event.tag === 'gate-tracker-sync' || event.tag === 'gate-tracker-auto-sync') {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'GATE_TRACKER_SYNC',
            timestamp: Date.now(),
          })
        })
      })
    )
  }
})

// 5. Message listener from client tabs
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
