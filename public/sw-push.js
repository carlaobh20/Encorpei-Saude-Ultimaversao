// ENCORPEI Push Notification Service Worker
// Handles background push notifications via Firebase/Web Push

self.addEventListener('push', function(event) {
  if (!event.data) return;
  
  const data = event.data.json();
  const title = data.title || 'ENCORPEI';
  const options = {
    body: data.body || 'Você tem uma nova notificação.',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: data.tag || 'encorpei-default',
    data: { url: data.url || '/' },
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Background sync for offline-first water/weight logging
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-offline-records') {
    event.waitUntil(syncOfflineRecords());
  }
});

async function syncOfflineRecords() {
  try {
    const cache = await caches.open('encorpei-offline-queue');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await fetch(request.clone());
        if (response.ok) {
          await cache.delete(request);
        }
      } catch (e) {
        // Keep in queue for next sync
      }
    }
  } catch (e) {
    console.error('Sync failed:', e);
  }
}
