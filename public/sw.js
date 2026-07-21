// [BUILD] Service Worker Updated: 2026-07-21T21:09:32.326Z
<<<<<<< HEAD
// [BUILD] Service Worker Updated: 2026-03-17T18:21:46.104Z

// IMPORTANTE: Versión incrementada para forzar actualización de lógica de borrado
const CACHE_STATIC = 'tienda-static-v145';
const CACHE_DYNAMIC = 'tienda-dynamic-v129';
const CACHE_IMAGES = 'tienda-images-v128';
const CACHE_API = 'tienda-api-v129';
=======
// [BUILD] Service Worker Updated: 2026-02-18T23:18:46.104Z

// IMPORTANTE: Versión incrementada para forzar actualización de lógica de borrado
const CACHE_STATIC = 'tienda-static-v137';
const CACHE_DYNAMIC = 'tienda-dynamic-v121';
const CACHE_IMAGES = 'tienda-images-v120';
const CACHE_API = 'tienda-api-v121';
>>>>>>> def495ebcf504c367e3f95241eb4e72b8dc55460

// Recursos críticos (Rutas relativas para soportar subcarpetas)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

const ALLOWED_DOMAINS = [
  'esm.sh',
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn-icons-png.flaticon.com',
  'images.unsplash.com',
  'placehold.co'
];

self.addEventListener('install', (event) => {
  // Eliminado self.skipWaiting() para control manual de la actualización
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== CACHE_STATIC &&
            cacheName !== CACHE_DYNAMIC &&
            cacheName !== CACHE_IMAGES &&
            cacheName !== CACHE_API
          ) {
            console.log('Limpiando caché obsoleta:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Listener para forzar el salto de espera cuando el usuario lo solicite
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isExternalAllowed = ALLOWED_DOMAINS.some(domain => url.hostname.includes(domain));
  const isSelf = url.origin === self.location.origin;

  if (event.request.method !== 'GET') return;
  if (!isSelf && !isExternalAllowed) return;

  // API: Network First
  if (url.pathname.includes('/api/') || url.search.includes('action=')) {
    event.respondWith(
      fetch(event.request)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_API);
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) return cachedResponse;
          return new Response(JSON.stringify({ error: 'offline', offline: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Imágenes: Cache First
  if (event.request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg)$/)) {
    event.respondWith(
      caches.open(CACHE_IMAGES).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (e) {
          return new Response('', { status: 404, statusText: 'Offline Image' });
        }
      })
    );
    return;
  }

  // HTML: Network First con Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(async () => {
          const cache = await caches.open(CACHE_STATIC);
          return cache.match('./index.html') || cache.match('/index.html');
        })
    );
    return;
  }

  // Assets estáticos (JS, CSS): Stale While Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {

      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Validar respuesta válida
        if (networkResponse && networkResponse.status === 200) {
          // CLONAR INMEDIATAMENTE para la caché
          const responseToCache = networkResponse.clone();
          const cacheName = isSelf ? CACHE_STATIC : CACHE_DYNAMIC;

          caches.open(cacheName).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((e) => {
        // Si falla red y no hay caché, retornar error o nada (ya manejado por el || abajo)
        // console.warn('Fetch failed:', e);
      });

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('push', function (event) {
  let data = { title: 'Notificación', body: 'Nuevo mensaje.', icon: '/icon.png', url: '/' };
  if (event.data) { try { data = event.data.json(); } catch (e) { data.body = event.data.text(); } }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: data.icon, data: { url: data.url }
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url || './'));
});
