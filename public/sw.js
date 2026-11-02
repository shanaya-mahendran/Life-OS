// LifeOS Service Worker - PWA & Offline Support
const CACHE_NAME = "lifeos-cache-v1";
const OFFLINE_URL = "/today";

const STATIC_ASSETS = [
  "/",
  "/today",
  "/calendar",
  "/chat",
  "/domains",
  "/settings",
  "/manifest.json",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon.svg",
  "/favicon.ico",
  "/favicon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Individual asset failure should not block install
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Ignore API and Chrome extension requests
  if (url.pathname.startsWith("/api/") || url.protocol.startsWith("chrome-extension")) {
    return;
  }

  // Network-first strategy with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.mode === "navigate") {
          const fallback = await caches.match(OFFLINE_URL);
          if (fallback) return fallback;
        }
        return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
      })
  );
});

// ── Native Push & Device Notifications ────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "LifeOS Notification", message: event.data?.text?.() ?? "New schedule update." };
  }

  const title = data.title || "LifeOS Alert 🔔";
  const options = {
    body: data.message || "Your scheduled block is coming up.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.link || "/today" },
    vibrate: [150, 80, 150],
    tag: data.id || "lifeos-event-notification",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/today";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "TRIGGER_NOTIFICATION") {
    const { title, message, link, id } = event.data;
    self.registration.showNotification(title || "LifeOS Reminder", {
      body: message || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: link || "/today" },
      vibrate: [150, 80, 150],
      tag: id || String(Date.now()),
    });
  }
});
