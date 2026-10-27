// Imported by sw.js. One worker owns /gymapptest2/ caching, updates and push.
// Register our click handler before the Firebase SDK installs its default handler.
self.addEventListener('notificationclick', event => {
  const data = event.notification.data;
  if (data?.FCM_MSG?.data?.target !== 'chat' && data?.gymTarget !== 'chat') return;
  event.stopImmediatePropagation();
  event.notification.close();
  const home = new URL(self.registration.scope);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
    const client = windows.find(client => { const url = new URL(client.url); return url.origin === home.origin && url.pathname.startsWith(home.pathname); });
    if (client) { client.postMessage({ type: 'gym:open-chat' }); await client.focus(); }
    else await self.clients.openWindow(new URL('?open=chat', home).href);
  }));
});
importScripts('vendor/firebase-messaging-worker.js');
