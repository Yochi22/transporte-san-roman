const CACHE_NAME = 'sanroman-shell-v1'
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copia = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copia)).catch(() => {})
        return response
      })
      .catch(() => caches.match(request))
  )
})
