// AirCheck+ Service Worker v2
// Force-reload strategy for iOS PWA cache busting

const CACHE_VERSION = '2.07.031';
const CACHE_NAME = 'aircheck-v' + CACHE_VERSION;

// ── INSTALL ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.add('./AirCheck_RD.html'))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ──
// Delete old caches and take control immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('aircheck-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => {
      self.clients.claim();
      // Tell all open clients to reload — new SW version is active
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }));
      });
    })
  );
});

// ── FETCH ──
// Network-first for HTML navigation — always fetch fresh
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isHTML = event.request.mode === 'navigate' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname === '/' ||
                 url.pathname.endsWith('/');

  if (isHTML) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./AirCheck_RD.html')))
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      });
    })
  );
});
