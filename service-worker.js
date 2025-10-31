const CACHE_NAME = "sos-cache-v4";
const FILES_TO_CACHE = [
  "index.html",
  "message.html",
  "offline.html",
  "manifest.json",
  "includes/header.html",
  "includes/footer.html",
  "public/sos_logo.png",
  "public/sos_favicon.png",
  "styles/main.css",
  "styles/header.css",
  "styles/footer.css",
  "shelters.html",
"styles/shelters.css",
"scripts/shelters.js"
];

// Installera & cachea alla filer
self.addEventListener("install", event => {
  console.log("📦 Installing SOS service worker...");
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Aktivera & ta bort gamla cache-versioner
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log("🧹 Deleting old cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
  console.log("✅ SOS service worker active");
});

// Hämta från cache först, annars nätet → fallback till offline.html
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request).catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("offline.html");
          }
        });
      })
  );
});
