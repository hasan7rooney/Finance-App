/* Service worker: keeps a copy of the Hub's own files on the phone so it opens offline.
   It only ever caches these files (the code). Your data lives in IndexedDB and is never sent anywhere. */
const VERSION = 'hub-v2.0.0';           // bump this whenever you upload new files
const FILES = ['./', './index.html', './styles.css', './core.js', './finance.js', './notes.js', './hub.js', './manifest.json', './icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Serve from the phone first (instant + offline). If online, quietly refresh the cached copy
// so the next launch gets any update you uploaded to GitHub.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    const network = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    return cached || (await network) || new Response('Offline', { status: 503 });
  }));
});
