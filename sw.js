const STATIC_CACHE = 'resident-manager-static-v1';
const STATIC_PREFIX = 'resident-manager-static-';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(STATIC_PREFIX) && name !== STATIC_CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

function safeNotificationTarget(value) {
  try {
    const raw = typeof value === 'string' ? value : '/';
    const target = new URL(raw, self.location.origin);
    if (target.origin !== self.location.origin || target.username || target.password) {
      return new URL('/', self.location.origin).href;
    }
    return target.href;
  } catch (_) {
    return new URL('/', self.location.origin).href;
  }
}

/* Mobile web push service worker */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (_) { data = { body: event.data ? event.data.text() : '' }; }

  const title = String(data.title || 'اعلان ساختمان');
  const options = {
    body: String(data.body || 'یک اعلان جدید دریافت کردید.'),
    icon: new URL('./icone-192.png', self.registration.scope).href,
    badge: new URL('./icone-192.png', self.registration.scope).href,
    dir: 'rtl',
    lang: 'fa',
    data: { url: safeNotificationTarget(data.url || '/') },
    tag: data.tag || 'building-notification',
    renotify: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = safeNotificationTarget(event.notification.data?.url || '/');
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});

// Cache only same-origin, versioned static resources. APIs, authentication,
// navigation documents and cross-origin requests always remain network-only.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!/\\.(?:js|css|webmanifest|png|svg|ico|woff2?)$/i.test(url.pathname)) return;

  // Loader retries add boot_attempt to the URL. Ignore that transient parameter
  // so each retry can use the same successfully cached static resource.
  const cacheUrl = new URL(url.href);
  cacheUrl.searchParams.delete('boot_attempt');
  const cacheRequest = new Request(cacheUrl.href, {
    method: 'GET',
    credentials: 'same-origin',
    headers: request.headers
  });

  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        event.waitUntil(cache.put(cacheRequest, response.clone()));
        return response;
      }
      if (response && response.status >= 500) {
        const cached = await cache.match(cacheRequest);
        if (cached) return cached;
      }
      return response;
    } catch (error) {
      const cached = await cache.match(cacheRequest);
      if (cached) return cached;
      throw error;
    }
  })());
});
