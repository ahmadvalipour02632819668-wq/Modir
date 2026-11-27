const STATIC_CACHE = 'resident-manager-static-v2';
const STATIC_PREFIX = 'resident-manager-static-';

const PRECACHE_ASSETS = [
  './core.js?v=6', './icons.js?v=1', './theme-ui.js?v=1', './timing.js?v=1',
  './menu-ui.js?v=1', './alert-ui.js?v=1', './alert-center.js?v=2', './sms.js?v=1',
  './media.js?v=1', './pwa.js?v=4', './assistant.js?v=2', './modal-ui.js?v=2',
  './push.js?v=2', './bale.js?v=1', './shell.js?v=19', './account-ui.js?v=1',
  './period-ui.js?v=2', './dashboard-ui.js?v=1', './dashboard.js?v=19',
  './community.js?v=9', './finance.js?v=13', './jalali-date.js?v=1',
  './management.js?v=30', './navigation.js?v=3', './app.css?v=3',
  './manifest.webmanifest?v=5', './icone-192.png', './icone-512.png', './icone.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    for (const asset of PRECACHE_ASSETS) {
      const url = new URL(asset, self.registration.scope);
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(new Request(url.href, {
            method: 'GET', cache: 'reload', credentials: 'same-origin'
          }));
          if (!response.ok) throw new Error('Precache failed: ' + response.status + ' ' + url.pathname);
          await cache.put(url.href, response.clone());
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
        }
      }
      if (lastError) throw lastError;
    }
    await self.skipWaiting();
  })());
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

// Versioned same-origin assets are cache-first. Once a device has received an
// asset successfully, temporary DNS/route/CDN failures cannot block startup.
// A changed asset URL or cache version causes a fresh download after deployment.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!/\.(?:js|css|webmanifest|png|svg|ico|woff2?)$/i.test(url.pathname)) return;

  const cacheUrl = new URL(url.href);
  cacheUrl.searchParams.delete('boot_attempt');
  const cacheRequest = new Request(cacheUrl.href, {
    method: 'GET',
    credentials: 'same-origin',
    headers: request.headers
  });

  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(cacheRequest);
    if (cached) return cached;

    const response = await fetch(request);
    if (response && response.ok) {
      event.waitUntil(cache.put(cacheRequest, response.clone()));
    }
    return response;
  })());
});
