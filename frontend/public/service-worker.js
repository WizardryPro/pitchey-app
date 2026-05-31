// KILL-SWITCH service worker.
//
// Earlier deployed versions of the app registered a service worker (/sw.js,
// /service-worker.js, /sw-mobile.js) that precached index.html + assets + API
// responses. The current app no longer registers any SW, but returning users
// still have the OLD worker installed and ACTIVE — it keeps serving its cached
// (stale) index.html, which points at old asset hashes, so fixes never reach
// them ("works in a fresh browser, not for the returning client").
//
// This replacement unregisters itself, deletes every cache, and reloads any
// controlled tabs so they fall back to the live network bundle. The browser
// re-fetches the SW script on its periodic update check (<=24h, and on
// navigation), so this propagates without any user action.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {
      // best-effort cache purge
    }
    try {
      await self.registration.unregister();
    } catch (e) {
      // ignore
    }
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    } catch (e) {
      // ignore
    }
  })());
});

// Never serve from cache — always hit the network (no stale responses).
self.addEventListener('fetch', () => {});
