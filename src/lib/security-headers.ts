/**
 * Response headers for every route (FIL-I10-6 L1), wired in next.config.ts.
 *
 * Scripts keep 'unsafe-inline': the App Router inlines its RSC bootstrap and a nonce would
 * need the proxy to mint one per request. What the policy still buys: no framing, no
 * plugins, no <base> hijack, forms only to us, and images/requests only to the hosts the
 * app really uses, so an injected script cannot load or send data elsewhere.
 */

/** Poster and logo hosts; keep in sync with `images.remotePatterns`. */
export const IMAGE_HOSTS = [
  "https://image.tmdb.org",
  "https://media.themoviedb.org",
  "https://upload.wikimedia.org",
];

export const contentSecurityPolicy = (dev: boolean) =>
  [
    "default-src 'self'",
    // next dev evaluates modules for HMR and Fast Refresh.
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${IMAGE_HOSTS.join(" ")}`,
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

export const securityHeaders = (dev: boolean) => [
  { key: "Content-Security-Policy", value: contentSecurityPolicy(dev) },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
