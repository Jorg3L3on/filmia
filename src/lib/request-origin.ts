/**
 * Origin of the incoming request, honouring the proxy headers Vercel sets.
 * `0.0.0.0` (next dev bound to all interfaces) is rewritten to a routable host.
 */
export const requestOrigin = (request: Request) => {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin.replace("://0.0.0.0", "://127.0.0.1");
};

/**
 * Public origin used for OAuth callbacks: `AUTH_URL` when set (must match the
 * redirect URI registered with the provider), otherwise the request origin.
 */
export const publicOrigin = (request: Request) => {
  const configured = process.env.AUTH_URL?.trim().replace(/\/+$/, "");
  return configured || requestOrigin(request);
};
