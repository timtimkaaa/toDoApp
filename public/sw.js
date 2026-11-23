const prefix = 'daylist-shell:' + self.registration.scope + ':';
const cacheName = prefix + '2';
const shell = [
  './index.html', './styles.css', './app.js', './model.mjs', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable.png'
].map(path => new URL(path, self.registration.scope).href);

self.addEventListener('install', event => {
  const requests = shell.map(url => new Request(url, { cache: 'reload' }));
  event.waitUntil(caches.open(cacheName)
    .then(cache => cache.addAll(requests))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate' && event.request.url.startsWith(self.registration.scope)) {
    event.respondWith(caches.open(cacheName).then(cache => cache.match(shell[0])).then(response => response || fetch(event.request)));
  } else if (shell.includes(event.request.url)) {
    event.respondWith(caches.open(cacheName).then(cache => cache.match(event.request)).then(response => response || fetch(event.request)));
  }
});
