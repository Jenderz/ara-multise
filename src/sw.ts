/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// Limpia automáticamente cachés obsoletas de builds anteriores
cleanupOutdatedCaches();

// Inyecta el manifiesto de activos estáticos y chunks generados por Vite (HTML, JS, CSS)
precacheAndRoute(self.__WB_MANIFEST);

/**
 * REGLA DE ORO DE INVENTARIO Y TASAS:
 * Las llamadas a la API ('api.php', 'rates.php', '/api/') NO son interceptadas ni cacheadas
 * por el Service Worker. Siempre viajan directo a la red (Network Only) para garantizar que
 * el stock disponible, los precios y la tasa de cambio sean 100% en tiempo real,
 * eliminando el riesgo de 'Stock Fantasma' o pedidos con existencias desfasadas.
 */

// 1. Imágenes locales y remotas: Cache First con retención de 30 días
registerRoute(
  ({ request, url }) =>
    request.destination === 'image' ||
    Boolean(url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico)$/i)) ||
    url.hostname.includes('cdn-icons-png.flaticon.com') ||
    url.hostname.includes('images.unsplash.com'),
  new CacheFirst({
    cacheName: 'ara-images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 150,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
      }),
    ],
  })
);

// 2. Fuentes web (Google Fonts): Stale While Revalidate
registerRoute(
  ({ url }) =>
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'ara-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 año
      }),
    ],
  })
);

// Listener para actualizar el Service Worker cuando el usuario lo acepte
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Gestión de Notificaciones Web Push (integrado con NotificationContext)
self.addEventListener('push', (event: PushEvent) => {
  let data = {
    title: 'Nueva Notificación',
    body: 'Tienes una novedad en la tienda.',
    icon: './icon.png',
    url: './',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || './icon.png',
      data: { url: data.url || './' },
    })
  );
});

// Acción al hacer clic en una notificación Push
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
