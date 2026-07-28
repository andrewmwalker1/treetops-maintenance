import { precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

// Without these, a newly-installed service worker sits "waiting" until
// every open tab of the app is closed -- for a PWA people leave open all
// day, that means deployed fixes never actually reach them. Activate a
// new version immediately instead.
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: payload.data || {},
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
