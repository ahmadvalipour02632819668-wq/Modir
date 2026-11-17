self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });

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

// Pass network requests through so the service worker also provides
// the fetch capability expected by Chromium's PWA installation checks.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Keep the PWA fetch handler for same-origin installability checks only.
  // Let cross-origin assets and APIs bypass this worker entirely.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request));
});
