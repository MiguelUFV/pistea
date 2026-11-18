/* Pistea · service worker mínimo. Solo existe para que el navegador ofrezca «Instalar aplicación».
   No guarda nada en caché: todo sigue pasando por la red, así que nunca hay una versión vieja ni datos de otra cuenta. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
