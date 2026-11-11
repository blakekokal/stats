// Offline support: the app shell is fetched network-first (so updates arrive),
// satellite tiles cache-first (they rarely change and are the bulk of the data).
const SHELL = 'shell-v1';
const TILES = 'tiles-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'server.arcgisonline.com') {
    e.respondWith(caches.open(TILES).then(async cache => {
      const hit = await cache.match(req.url);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req.url, res.clone());
      return res;
    }));
  } else if (url.origin === self.location.origin) {
    e.respondWith(caches.open(SHELL).then(async cache => {
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        throw err;
      }
    }));
  }
});
