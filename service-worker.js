// ===== SOS App Service Worker — v1.3 (tiles caching) =====

const CORE_CACHE = "sos-core-v13";
const TILE_CACHE = "sos-tiles-v13";
const TILE_CACHE_MAX_ENTRIES = 700; // ~20–30 MB beroende på tile-storlek

// Lägg till alla sidor/asset du vill ha offline
const FILES_TO_CACHE = [
  "index.html",
  "message.html",
  "radio.html",
  "shelters.html",
  "offline.html",
  "manifest.json",

  // includes
  "includes/header.html",
  "includes/footer.html",

  // styles
  "styles/main.css",
  "styles/header.css",
  "styles/footer.css",
  "styles/shelters.css",

  // scripts
  "scripts/shelters.js",

  // images/icons
  "public/sos_logo.png",
  "public/sos_favicon.png",
  "message.html",
"styles/message.css",
"scripts/message.js",
  "dashboard.html",
"styles/dashboard.css",
"scripts/dashboard.js",
  "health.html",
"styles/health.css",
"scripts/health.js",
  "map.html",
"styles/map.css",
"scripts/map.js",
// om du hostar tiles lokalt:
"public/tiles/"
];

// Hjälpare: trim tile-cache efter gräns
async function trimTileCache() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  if (keys.length <= TILE_CACHE_MAX_ENTRIES) return;
  // Ta bort äldsta först (keys() är i insättningsordning i de flesta motorer)
  const toDelete = keys.length - TILE_CACHE_MAX_ENTRIES;
  for (let i = 0; i < toDelete; i++) {
    await cache.delete(keys[i]);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(FILES_TO_CACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Rensa gamla versioner
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => ![CORE_CACHE, TILE_CACHE].includes(k))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// Domäner som behandlas som kartplattor (Leaflet/OSM)
const TILE_HOSTS = [
  "tile.openstreetmap.org",
  "a.tile.openstreetmap.org",
  "b.tile.openstreetmap.org",
  "c.tile.openstreetmap.org",
];

// Fetch-strategier:
// - Navigationsförfrågningar: Network-first → offline.html fallback
// - Karttiles: Cache-first (lägg till i TILE_CACHE, trimma)
// - Övrigt: Statiska filer cache-first från CORE_CACHE
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Navigeringar
  if (req.mode === "navigate" || (req.method === "GET" && req.headers.get("accept")?.includes("text/html"))) {
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        // Cachea en kopia av navigationssidan (valfritt)
        const cache = await caches.open(CORE_CACHE);
        cache.put(req, net.clone()).catch(()=>{});
        return net;
      } catch {
        const cache = await caches.open(CORE_CACHE);
        const cached = await cache.match(req);
        return cached || cache.match("offline.html");
      }
    })());
    return;
  }

  // 2) Karttiles
  if (req.method === "GET" && TILE_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(TILE_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;

      try {
        const net = await fetch(req, { mode: "cors" });
        // Endast cachea lyckade svar
        if (net.ok) {
          cache.put(req, net.clone()).catch(()=>{});
          // Trimma cache asynkront
          trimTileCache().catch(()=>{});
        }
        return net;
      } catch {
        // Om ingen tile i cache, ge en transparent 256x256 PNG som fallback
        const transparentPNG =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAABx0wDUAAAAAklEQVR42u3BMQEAAADCoPVPbQ0PoAAAAAAAAAAA4I8AAgAB";
        return new Response(await (await fetch(transparentPNG)).blob(), {
          headers: { "Content-Type": "image/png" }
        });
      }
    })());
    return;
  }

  // 3) Övriga GET (statiska): cache-first
  if (req.method === "GET") {
    event.respondWith((async () => {
      const cache = await caches.open(CORE_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const net = await fetch(req);
        if (net.ok && (url.origin === location.origin)) {
          cache.put(req, net.clone()).catch(()=>{});
        }
        return net;
      } catch {
        // Fallback: om begärd fil var HTML, visa offline.html
        if (req.headers.get("accept")?.includes("text/html")) {
          const off = await cache.match("offline.html");
          if (off) return off;
        }
        throw new Error("Network fail & no cache");
      }
    })());
  }
});
