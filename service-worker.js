const CACHE_NAME = 'radiocom-v1';
const APP_SHELL = [
  './',
  './index.html',
  './friends.html',
  './images.html',
  './team.html',
  './trenink.html',
  './print.html',
  './img-viewer.html',
  './assets/css/style.css',
  './assets/css/private.css',
  './assets/js/site.js',
  './assets/js/private.js',
  './assets/js/downloads.js',
  './assets/js/downloads-data.js',
  './assets/js/img-viewer.js',
  './assets/js/pwa.js',
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
