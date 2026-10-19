/**
 * Paths that must not pay for a Neon session-version lookup.
 * The service worker and launch artwork are public and identical for every user.
 * HTML, RSC, and API routes stay gated.
 */
export const isProxyStaticAsset = (pathname: string) =>
  pathname.startsWith("/_next/") ||
  pathname === "/favicon.ico" ||
  pathname === "/sw.js" ||
  pathname === "/filmia-mark.png" ||
  pathname.endsWith(".webmanifest") ||
  pathname.startsWith("/icon-") ||
  pathname.startsWith("/splash/") ||
  pathname.startsWith("/posters/") ||
  /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(pathname);
