/* Pistea · service worker.
   Guarda SOLO lo estático y público (la página, app.js, calc.js, tipografías, fotos y datos de las estaciones) para que la app abra al
   instante y, sin cobertura, enseñe su pantalla de «Sin conexión» en vez de una página en blanco.
   Nunca toca /api, /3d, /panel ni nada que no sea GET del mismo origen: así no hay datos de otra cuenta ni sesiones en la caché.
   La página, app.js y calc.js van «red primero» (siempre la versión nueva si hay red); fotos y datos, «caché primero» y se refrescan al fondo. */
const V = 'pistea-v1', SHELL = ['/', '/app.js', '/calc.js'];
const NET_FIRST = new Set(['/', '/index.html', '/app.js', '/calc.js']);
const STATIC = /^\/(img|seg|fonts)\//;

self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  const guardar = res => { if (res && res.ok && res.status === 200) { const c = res.clone(); caches.open(V).then(k => k.put(r, c)).catch(() => {}); } return res; };
  if (r.mode === 'navigate' && u.pathname === '/') {
    e.respondWith(fetch(r).then(guardar).catch(() => caches.match('/').then(x => x || Response.error())));
  } else if (NET_FIRST.has(u.pathname)) {
    e.respondWith(fetch(r).then(guardar).catch(() => caches.match(r, { ignoreSearch: true }).then(x => x || Response.error())));
  } else if (STATIC.test(u.pathname)) {
    e.respondWith(caches.match(r).then(hit => {
      const red = fetch(r).then(guardar).catch(() => hit || Response.error());
      return hit || red;
    }));
  }
});
