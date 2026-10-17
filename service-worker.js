const CACHE_NAME = 'radiocom-v5';
const APP_SHELL = [
  './',
  './404.html',
  './index.html',
  './friends.html',
  './images.html',
  './team.html',
  './trenink.html',
  './print.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/css/404.css',
  './assets/css/private.css',
  './assets/brand/radiocom-mark.svg',
  './assets/brand/radiocom-social.svg',
  './assets/brand/apple-touch-icon.png',
  './assets/js/site.js',
  './assets/js/404.js',
  './assets/js/private.js',
  './assets/js/downloads.js',
  './assets/js/downloads-data.js',
  './assets/js/pwa.js',
  './assets/fonts/barlow-condensed-latin-600-normal.woff2',
  './assets/fonts/barlow-condensed-latin-700-normal.woff2',
  './assets/fonts/barlow-condensed-latin-ext-600-normal.woff2',
  './assets/fonts/barlow-condensed-latin-ext-700-normal.woff2',
  './assets/fonts/inter-latin-400-normal.woff2',
  './assets/fonts/inter-latin-500-normal.woff2',
  './assets/fonts/inter-latin-ext-400-normal.woff2',
  './assets/fonts/inter-latin-ext-500-normal.woff2',
  './assets/fonts/jetbrains-mono-latin-400-normal.woff2',
  './assets/fonts/jetbrains-mono-latin-500-normal.woff2',
  './assets/fonts/jetbrains-mono-latin-ext-400-normal.woff2',
  './assets/fonts/jetbrains-mono-latin-ext-500-normal.woff2',
  './assets/vendor/leaflet/leaflet.css',
  './assets/vendor/leaflet/leaflet.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./404.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./404.html');
        throw new Error('Offline resource unavailable');
      });
    })
  );
});
