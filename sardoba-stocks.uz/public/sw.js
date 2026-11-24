// ULGURJI service worker: ilova qobig'ini keshlaydi, /api so'rovlarini hech qachon keshlamaydi.
const CACHE = "ulgurji-v3";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/favicon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Sahifa yuklagan JS/CSS fayllarni ham keshga qo'yamiz (internet o'chsa ilova ochilishi uchun)
self.addEventListener("message", (e) => {
  if (e.data?.type === "cache" && Array.isArray(e.data.urls)) {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(e.data.urls).catch(() => {})));
  }
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api")) return;

  // Sahifa: avval internetdan (yangi versiya), bo'lmasa keshdan
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          caches.open(CACHE).then((c) => c.put("/index.html", r.clone()));
          return r;
        })
        .catch(() => caches.match("/index.html", { ignoreVary: true })),
    );
    return;
  }

  // JS/CSS/rasmlar: keshdan, bo'lmasa internetdan olib keshga qo'yamiz
  e.respondWith(
    caches.match(e.request, { ignoreVary: true, ignoreSearch: false }).then(
      (hit) =>
        hit ||
        fetch(e.request).then((r) => {
          if (r.ok && (url.pathname.startsWith("/assets/") || /\.(png|svg|webmanifest)$/.test(url.pathname))) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return r;
        }),
    ),
  );
});
