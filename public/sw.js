/* Filmia Fase 5 / JOR-219 — assets-only service worker.
 * Caches same-origin static assets (JS/CSS/fonts/icons) only.
 * Never caches HTML navigations, RSC/flight, API, or diary/user data.
 * No offline sync.
 * FIL-I12: also shows Web Push notices («Llegó a tu plataforma») and opens their ficha.
 */
const CACHE = "filmia-assets-v5";

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
    (async () => {
      // Navigations are not intercepted (no HTML cache). Preload still starts
      // the document request while this worker boots, so a cold open does not
      // wait out the worker startup before the network begins.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
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

/** Payload from src/lib/push/web-push.ts: { title, body, url, tag?, icon? }. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = typeof payload.title === "string" && payload.title ? payload.title : "Filmia";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof payload.body === "string" ? payload.body : "",
      icon: typeof payload.icon === "string" ? payload.icon : "/icon-192.png",
      badge: "/icon-192.png",
      tag: typeof payload.tag === "string" ? payload.tag : undefined,
      lang: "es",
      data: { url: typeof payload.url === "string" ? payload.url : "/" },
    }),
  );
});

/** Same-origin paths only, so a payload can never send the app somewhere else. */
const notificationTarget = (data) => {
  try {
    const url = new URL((data && data.url) || "/", self.location.origin);
    return url.origin === self.location.origin ? url.href : self.location.origin + "/";
  } catch {
    return self.location.origin + "/";
  }
};

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = notificationTarget(event.notification.data);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if ("navigate" in open) {
          return open.navigate(target);
        }
        return undefined;
      }
      return self.clients.openWindow(target);
    }),
  );
});
