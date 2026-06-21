// ─── SepsiGo Service Worker ──────────────────────────────────────────────────
const CACHE_NAME = 'sepsigo-v10';

// Aset statis yang aman di-cache lama (icons, logo — jarang berubah)
const STATIC_ASSETS = [
  './Logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ── INSTALL: cache hanya aset statis ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: hapus semua cache versi lama ───────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
// HTML (index.html, SepsiGo.html)  → Network-First: selalu ambil versi terbaru,
//                                    fallback ke cache jika offline.
// Aset statis (icons, Logo, fonts) → Cache-First: cepat, jarang berubah.
// Lainnya                          → Network only.
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  const isHTML = request.destination === 'document' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname === '';

  const isStaticAsset =
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.pathname.includes('/icons/') ||
    url.pathname.endsWith('Logo.png') ||
    url.pathname.endsWith('manifest.json');

  if (isHTML) {
    // Network-First untuk HTML — update selalu terlihat
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request)
          .then(cached => cached || caches.match('./SepsiGo.html'))
        )
    );
    return;
  }

  if (isStaticAsset) {
    // Cache-First untuk aset statis
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Semua request lain: network langsung (API, dll.)
});

// ── MESSAGE ───────────────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
