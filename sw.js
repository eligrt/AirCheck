// AirCheck+ Service Worker
// Ensures iOS PWA users always get the latest version on launch
// Version: bump CACHE_VERSION on every app release to force update

const CACHE_VERSION = '2.07.029';
const CACHE_NAME = 'aircheck-v' + CACHE_VERSION;

// Files to cache on install
const PRECACHE_URLS = [
  './AirCheck_RD.html',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Hebrew:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap'
];

// ── INSTALL ──
// Cache the app shell on first install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // activate immediately, don't wait
  );
});

// ── ACTIVATE ──
// Delete old caches from previous versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('aircheck-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // take control of all open pages immediately
  );
});

// ── FETCH ──
// Network-first strategy for HTML — always try to get fresh version
// Falls back to cache if offline
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests and our main HTML file
  if (event.request.mode === 'navigate' ||
      url.pathname.endsWith('AirCheck_RD.html') ||
      url.pathname === '/' ||
      url.pathname.endsWith('/')) {

    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Got fresh response — update cache
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline — serve from cache
          return caches.match(event.request)
            .then(cached => cached || caches.match('./AirCheck_RD.html'));
        })
    );
    return;
  }

  // For all other requests (fonts, Firebase SDK etc) — cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});
