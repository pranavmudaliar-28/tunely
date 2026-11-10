/* global self, URL */
// Tunely's service worker. It only shows notifications a viewer asked for ("back online", programme reminders) and
// opens the page they point to. It caches nothing, so a deploy is never hidden behind stale files.

self.addEventListener('push', (event) => {
  let n = {};
  try {
    n = event.data ? event.data.json() : {};
  } catch {
    // Not ours or not JSON: show nothing odd.
  }
  const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  // Only paths on this site.
  const url = typeof n.url === 'string' && n.url.startsWith('/') && !n.url.startsWith('//') ? n.url : '/';
  event.waitUntil(
    self.registration.showNotification(text(n.title, 120) || 'Tunely', {
      body: text(n.body, 200),
      icon: '/pwa-icon/192',
      tag: text(n.tag, 200) || undefined,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url === url);
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});
