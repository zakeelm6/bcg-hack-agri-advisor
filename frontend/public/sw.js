// Service worker: the app opens without a connection. On install it stores the shell pages; static assets are cached as they
// are fetched (hashed, so cache-first is safe); pages are network-first with the stored copy as fallback.
// API data is kept by the app itself (localStorage copies in lib/api.ts), which also queues writes and replays them through /api/sync.
const CACHE = "farm-advisor-react-v2";
const SHELL = ["/home", "/tasks", "/field", "/sell", "/alerts", "/me", "/", "/manifest.json", "/icon.svg"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  if (u.pathname.startsWith("/_next/static/")) {   // hashed assets: cache first
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })));
    return;
  }
  e.respondWith(
    fetch(e.request).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return res; })
      .catch(async () => (await caches.match(e.request, { ignoreSearch: true })) || (e.request.mode === "navigate" ? (await caches.match(u.pathname.split("/").slice(0, 2).join("/") || "/home")) || caches.match("/home") : undefined))
  );
});
