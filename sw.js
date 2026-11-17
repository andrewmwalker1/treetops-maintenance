import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { clientsClaim } from "workbox-core";

// Without these, a newly-installed service worker sits "waiting" until
// every open tab of the app is closed -- for a PWA people leave open all
// day, that means deployed fixes never actually reach them. Activate a
// new version immediately instead.
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

// Single-page app: every in-app address (/jobs/new, /meter-reading/scan...)
// is really index.html. precacheAndRoute alone only answers for the exact
// precached URLs, so reopening the app offline on any page but "/" fell
// through to the network and failed. Serve the cached index.html for all
// page navigations instead -- except real files (anything with an
// extension, e.g. /tools/campmanager-to-sage.html, /404.html).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/\/[^/?]+\.[^/?]+$/],
  })
);

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
