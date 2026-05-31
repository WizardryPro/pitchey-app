// KILL-SWITCH service worker (see service-worker.js for full rationale).
// Earlier app versions registered /sw.js and precached the bundle, pinning
// returning users to a stale index.html. This unregisters + purges caches so
// controlled tabs fall back to the live network bundle.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) { /* best-effort */ }
    try {
      await self.registration.unregister();
    } catch (e) { /* ignore */ }
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    } catch (e) { /* ignore */ }
  })());
});

self.addEventListener('fetch', () => {});
