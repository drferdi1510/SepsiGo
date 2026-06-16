// ─── SepsiGo Service Worker ──────────────────────────────────────────────────
// Versi cache — naikkan angka ini setiap kali ada update file agar cache lama
// otomatis dihapus dan diganti yang baru.
const CACHE_NAME = 'sepsigo-v4';

// File-file yang di-cache saat install (App Shell)
const APP_SHELL = [
  './index.html',
  './SepsiGo.html',
  './manifest.json',
  './Logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ── INSTALL: cache semua file app shell ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())  // aktifkan SW baru segera
  );
});

// ── ACTIVATE: hapus cache versi lama ────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())  // ambil kendali semua tab segera
  );
});

// ── FETCH: strategi Cache-First dengan fallback ke network ──────────────────
// Semua request dicoba dari cache dulu.
// Jika tidak ada di cache (misal font Google), coba ambil dari network dan
// simpan ke cache untuk request berikutnya.
// Jika network juga gagal (offline), kembalikan halaman utama dari cache.
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Hanya handle GET request
  if (request.method !== 'GET') return;

  // Lewati request ke chrome-extension atau non-http
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;

        // Tidak ada di cache — ambil dari network
        return fetch(request)
          .then(response => {
            // Hanya cache response yang valid (status 200, bukan opaque)
            if (
              response &&
              response.status === 200 &&
              response.type !== 'opaque'
            ) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                // Cache font Google dan aset statis
                if (
                  url.hostname === 'fonts.googleapis.com' ||
                  url.hostname === 'fonts.gstatic.com' ||
                  url.pathname.startsWith('./icons/')
                ) {
                  cache.put(request, responseClone);
                }
              });
            }
            return response;
          })
          .catch(() => {
            // Network gagal — kembalikan halaman utama dari cache
            if (request.destination === 'document') {
              return caches.match('./SepsiGo.html');
            }
            // Untuk resource lain, kembalikan response kosong
            return new Response('', { status: 408, statusText: 'Offline' });
          });
      })
  );
});

// ── MESSAGE: handle pesan dari halaman utama ─────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
