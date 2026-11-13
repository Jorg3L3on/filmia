import { createHash } from "node:crypto";
import { checkRateLimit, clientIp, RATE_LIMIT_MESSAGE, RATE_LIMITS, type RateLimitStore } from "@/lib/rate-limit";
import { RETO_LINK_PREFIX } from "@/lib/juegos/retos/core";

/**
 * The public reto link's door (FIL-I53-4): every page open of `/reto/<token>` counts against the
 * IP; past the limit the proxy answers 429 before the page runs. Server Function POSTs (the answers)
 * are not counted here: they need a valid token, which nobody can guess.
 *
 * An unknown or expired token is answered 404 here too: the app's root `loading.tsx` makes a page
 * stream as 200 before `notFound()` runs, so a real 404 has to come before the page (Next docs).
 */

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** Whether a token opens a live link reto: its hash is stored, not cancelled, inside its 48 hours. */
export type RetoLinkLookup = (tokenHash: string, now: Date) => Promise<boolean>;

const NOT_FOUND_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Reto no disponible · Filmia</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#111417;color:#f3efe6;font-family:system-ui,sans-serif;text-align:center;padding:24px"><main><h1 style="font-size:22px;margin:0 0 8px">Este reto ya no está disponible</h1><p style="color:#9aa3ab;margin:0 0 20px">Los retos por enlace duran 48 horas.</p><a href="/" style="color:#ff8a4c;font-weight:600">Ir a Filmia</a></main></body></html>`;
export const isRetoLinkOpen = (pathname: string, method: string) =>
  method === "GET" && pathname.startsWith(`${RETO_LINK_PREFIX}/`);

export const retoLinkGate = async (
  request: Request,
  store: RateLimitStore,
  lookup: RetoLinkLookup | null,
  now = new Date(),
): Promise<Response | null> => {
  const { pathname } = new URL(request.url);
  if (!isRetoLinkOpen(pathname, request.method)) return null;
  let check;
  try {
    check = await checkRateLimit(store, [{ rule: RATE_LIMITS.retoLinkIp, subject: clientIp(request.headers) }], now);
  } catch (error) {
    // Fail open: the page itself still needs a valid token.
    console.error("[rate-limit] reto link store unavailable", error);
    return null;
  }
  if (!check.ok) {
    return new Response(RATE_LIMIT_MESSAGE, {
      status: 429,
      headers: { "content-type": "text/plain; charset=utf-8", "retry-after": String(check.retryAfterSeconds) },
    });
  }
  if (!lookup) return null;
  const token = pathname.slice(RETO_LINK_PREFIX.length + 1).split("/")[0] ?? "";
  let live = false;
  try {
    live = TOKEN_SHAPE.test(token) && (await lookup(createHash("sha256").update(token).digest("hex"), now));
  } catch (error) {
    // The page checks again; a lookup error must not hide a good link.
    console.error("[retos] link lookup failed", error);
    return null;
  }
  return live ? null : new Response(NOT_FOUND_HTML, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
};
