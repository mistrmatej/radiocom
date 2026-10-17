(function () {
  'use strict';
  if ('serviceWorker' in navigator) {
    var hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (hadController) window.location.reload();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' })
        .then(function (registration) {
          return registration.update();
        })
        .catch(function (error) {
          console.error('Service worker registration failed:', error);
        });
    });
  }
})();
