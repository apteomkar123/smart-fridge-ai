const CACHE = 'hungry-v1';

// On install: cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['/', '/manifest.json'])
    )
  );
  self.skipWaiting();
});

// On activate: delete any old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never cache Netlify function calls or Supabase — always hit the network
  if (
    url.pathname.startsWith('/.netlify/functions/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('themealdb.com') ||
    url.hostname.includes('openfoodfacts.org') ||
    url.hostname.includes('generativelanguage.googleapis.com')
  ) {
    return;
  }

  // Hashed static assets (/assets/...): cache-first, they never change
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, clone));
            return res;
          })
      )
    );
    return;
  }

  // Navigation and everything else: network-first, fall back to cache
  // (so the app shell loads offline)
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request) || caches.match('/'))
  );
});
