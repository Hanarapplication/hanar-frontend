/**
 * FCM service worker: receives background push and shows notification.
 * Requires HTTPS in production. Config is fetched from same-origin API.
 */
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const configPromise = fetch('/api/firebase-config')
  .then(function (res) { return res.json(); })
  .then(function (data) {
    return {
      apiKey: data.apiKey || '',
      authDomain: data.authDomain || '',
      projectId: data.projectId || '',
      storageBucket: data.storageBucket || '',
      messagingSenderId: data.messagingSenderId || '',
      appId: data.appId || '',
    };
  })
  .catch(function () {
    return null;
  });

configPromise.then(function (config) {
  if (!config || !config.apiKey || !config.projectId) return;
  firebase.initializeApp(config);
  const messaging = firebase.messaging();
  if (typeof messaging.onBackgroundMessage !== 'function') return;
  messaging.onBackgroundMessage(function (payload) {
    var title = (payload.notification && payload.notification.title) || payload.data?.title || 'Hanar';
    var body = (payload.notification && payload.notification.body) || payload.data?.body || '';
    var icon = (payload.notification && payload.notification.icon) || payload.data?.icon || '/hanar-logo.png';
    var url = payload.data?.url || '/';
    var options = {
      body: body || 'New notification',
      icon: icon,
      badge: icon,
      tag: payload.data?.tag || 'hanar-push',
      data: { url: url },
      requireInteraction: false,
    };
    return self.registration.showNotification(title, options);
  });
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
