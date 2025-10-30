// 🔹 SOS App – Offline Service Worker
const CACHE_NAME = "sos-cache-v1";
const FILES_TO_CACHE = [
  "index.html",
  "message.html",
  "manifest.json",
  "includes/header.html",
  "includes/footer.html",
  "public/sos_logo.png",
  "public/sos_favicon.png",
  "styles/main.css",
  "styles/header.css",
  "styles/footer.css"
];

// 🔹 Install – cache all essential files
self.addEventListener("install", event => {
  console.log("📦 Installing SOS service worker...");
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// 🔹 Activate – clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
  console.log("✅ SOS service worker active");
});

// 🔹 Fetch – serve from cache, fallback to network
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request).catch(() => {
          // Optional: fallback offline page
          if (event.request.mode === "navigate") {
            return caches.match("message.html");
          }
        });
      })
  );
});
