const CACHE_NAME = "medease-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/core/db.js",
  "./js/core/ui.js",
  "./js/modules/dashboard.js",
  "./js/modules/dues.js",
  "./js/modules/inventory.js",
  "./js/modules/pos.js",
  "./js/modules/pos-utils.js",
  "./js/modules/sales.js",
  "./js/modules/suppliers.js",
];

// Install event: cache assets safely
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Add assets one by one so a missing file doesn’t break install
      for (const asset of ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          // Skip missing asset instead of failing install
          console.warn("Service Worker: Failed to cache", asset, err);
        }
      }
    })(),
  );
});

// Activate event: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }),
      ),
    ),
  );
});

// Fetch event: network-first with safe fallback
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (err) {
          // Fallback to cached index.html if offline
          const cache = await caches.open(CACHE_NAME);
          const cachedIndex = await cache.match("./index.html");
          return cachedIndex || Response.error();
        }
      })(),
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return (
          response ||
          fetch(event.request).catch(() => {
            // If both fail, return a generic error response
            return Response.error();
          })
        );
      }),
    );
  }
});