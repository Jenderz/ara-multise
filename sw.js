// [BUILD] Service Worker Updated: 2026-09-11T13:08:00.000Z

// IMPORTANTE: Versión incrementada para forzar actualización de caché tras build (v156)
const CACHE_STATIC = 'tienda-static-v156';
const CACHE_DYNAMIC = 'tienda-dynamic-v140';
const CACHE_IMAGES = 'tienda-images-v135';

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
  // Activa inmediatamente el nuevo SW para evitar desincronizaciones de chunks y 503
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Limpia automáticamente cachés obsoletas, incluyendo cualquier CACHE_API antigua
          if (
            cacheName !== CACHE_STATIC &&
            cacheName !== CACHE_DYNAMIC &&
            cacheName !== CACHE_IMAGES
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

  // REGLA DE ORO: Las llamadas a la API y endpoints PHP nunca deben ser interceptadas ni cacheadas por el SW.
  // Pasan directo a la red (Network Only) para garantizar stock en tiempo real y evitar que errores o HTML queden cacheados.
  if (
    url.pathname.includes('/api/') ||
    url.pathname.includes('api.php') ||
    url.pathname.includes('rates.php') ||
    url.pathname.includes('seo-proxy.php') ||
    url.pathname.includes('favicon.php') ||
    url.pathname.includes('favicon.ico') ||
    url.pathname.includes('robots.txt') ||
    url.pathname.includes('robots.php') ||
    url.pathname.includes('sitemap.xml') ||
    url.pathname.includes('sitemap.php') ||
    url.pathname.includes('cron_notifications.php') ||
    url.search.includes('action=')
  ) {
    return; // Permite la petición nativa directa al servidor
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
          const cached = await cache.match('./index.html') || await cache.match('/index.html');
          return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
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
        // Fallback defensivo: retornar caché existente o un error controlado sin 503 intrusivo
        return cachedResponse || new Response('', { status: 404, statusText: 'Offline Asset Unavailable' });
      });

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('push', function (event) {
  var data = {
    title: 'Nueva Notificación',
    body: 'Tienes una novedad en la tienda.',
    icon: './icon.png',
    badge: './icon.png',
    url: './',
    tag: 'ara-notification'
  };

  if (event.data) {
    try {
      var parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        data = Object.assign(data, parsed);
      }
    } catch (e) {
      var text = event.data.text();
      if (text) data.body = text;
    }
  }

  var options = {
    body: data.body,
    icon: data.icon || './icon.png',
    badge: data.badge || data.icon || './icon.png',
    tag: data.tag || ('ara-notif-' + Date.now()),
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || './' }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client && client.url.indexOf(self.location.origin) !== -1) {
          if ('navigate' in client && targetUrl !== './') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
