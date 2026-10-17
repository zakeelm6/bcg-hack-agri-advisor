// Service worker: lets growmate open with no network. Same-origin GET requests only (the API is another origin and has its own
// copy of the last answer in localStorage, see lib/engine.ts). Pages and data: network first, the saved copy when it fails.
// Built files, fonts and pictures: saved copy first (their names change when their content changes).
const VERSION = "growmate-v2";
const SHELL = ["/", "/farm", "/copilot", "/activities", "/manifest.webmanifest", "/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const isStatic = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/images/") || url.pathname.startsWith("/_next/image") || /\.(png|webp|svg|woff2?|mjs)$/.test(url.pathname);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  if (isStatic(url)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // Pages (and the data Next.js fetches to change page): try the network, keep a copy, use the copy when offline.
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(async () => (await caches.match(req)) || (req.mode === "navigate" ? (await caches.match(url.pathname)) || (await caches.match("/farm")) || (await caches.match("/")) : undefined) || Response.error()));
});
