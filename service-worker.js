const CACHE_NAME = 'radiocom-v3';
const APP_SHELL = [
  './',
  './index.html',
  './friends.html',
  './images.html',
  './team.html',
  './trenink.html',
  './print.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/css/private.css',
  './assets/brand/radiocom-mark.svg',
  './assets/brand/radiocom-social.svg',
  './assets/brand/apple-touch-icon.png',
  './assets/js/site.js',
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
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }))
  );
});
