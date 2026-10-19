/* Offline support for the Barcelona trip page.
   Bump VERSION when you change index.html if you want phones to drop the old copy
   immediately; otherwise they pick up changes on the next visit after this one. */
const VERSION = "bcn-trip-v6";
const ASSETS = [
  "./",
  "./index.html",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache =>
    Promise.all(ASSETS.map(url => cache.add(new Request(url, { mode: url.startsWith("http") ? "cors" : "same-origin" })).catch(() => {})))
  ).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Map tiles: straight to the network (they don't need to work offline).
  if (url.hostname.endsWith("tile.openstreetmap.org")) return;

  // The page itself: show the cached copy at once, refresh it in the background.
  if (req.mode === "navigate" || (url.origin === location.origin)) {
    event.respondWith(caches.open(VERSION).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true }) ||
                     (req.mode === "navigate" ? await cache.match("./index.html") : undefined);
      const network = fetch(req).then(res => {
        if (res && res.ok) cache.put(req.mode === "navigate" ? "./index.html" : req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    }));
    return;
  }

  // Leaflet from the CDN: cache first.
  if (url.hostname === "unpkg.com") {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
