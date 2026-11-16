const CACHE = 'featherwood-v4';
const FILES = ['./', 'index.html', 'game.js', 'vendor/three.module.min.js', 'vendor/BufferGeometryUtils.js', 'tex/oak_col.jpg', 'tex/oak_nrm.jpg', 'tex/maple_col.jpg', 'tex/maple_nrm.jpg', 'tex/redwood_col.jpg', 'tex/redwood_nrm.jpg', 'tex/ground_col.jpg', 'tex/ground_nrm.jpg', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
