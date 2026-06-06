// Bump the cache version whenever app files change so returning users
// always get the latest code and not a stale cached version.
const CACHE_NAME = "medease-cache-v2";

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
  "./js/modules/settings.js",
  "./js/modules/suppliers.js",
];

// Install: cache all assets one by one so a single missing file does
// not break the entire install
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const asset of ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn("Service Worker: failed to cache", asset, err);
        }
      }
      // Activate the new service worker immediately without waiting for
      // existing tabs to close
      self.skipWaiting();
    })(),
  );
});

// Activate: remove any old caches from previous versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) return caches.delete(key);
          }),
        ),
      )
      .then(() => {
        // Take control of all open tabs immediately
        return self.clients.claim();
      }),
  );
});

// Fetch: network-first for navigation, cache-first for all other assets
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request);
        } catch {
          const cache = await caches.open(CACHE_NAME);
          const cachedIndex = await cache.match("./index.html");
          return cachedIndex || Response.error();
        }
      })(),
    );
  } else {
    event.respondWith(
      caches
        .match(event.request)
        .then(
          (response) =>
            response || fetch(event.request).catch(() => Response.error()),
        ),
    );
  }
});
