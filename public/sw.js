/* Filmia Fase 5 / JOR-219 — assets-only service worker.
 * Caches same-origin static assets (JS/CSS/fonts/icons) only.
 * Never caches HTML navigations, RSC/flight, API, or diary/user data.
 * No offline sync.
 */
const CACHE = "filmia-assets-v1";

const PRECACHE = [
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Same-origin static asset paths only — never HTML/API/RSC. */
const isStaticAsset = (url) => {
  const { pathname } = url;
  if (pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/_next/static/")) return true;
  if (pathname.startsWith("/_next/")) return false;
  return /\.(?:js|css|woff2?|ttf|otf|eot|ico|png|svg|webp|avif)$/i.test(pathname);
};

const isUnsafeRequest = (request) => {
  if (request.method !== "GET") return true;
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  if (accept.includes("text/html")) return true;
  // Next App Router RSC / soft navigation payloads carry auth-gated data.
  if (
    request.headers.has("rsc") ||
    request.headers.has("next-router-state-tree") ||
    request.headers.has("next-router-prefetch") ||
    request.headers.has("next-url")
  ) {
    return true;
  }
  return false;
};

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (isUnsafeRequest(request)) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!isStaticAsset(url)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    }),
  );
});
