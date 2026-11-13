import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { sessionCookieOptions, verifySessionToken } from "@/lib/auth/session-token";
import { isSessionCurrent } from "@/lib/auth/session-version";
import { ONBOARDING_PATH, onboardingHref } from "@/lib/onboarding/steps";
import { safeNextPath } from "@/lib/google-oauth";
import { isProxyStaticAsset } from "@/lib/proxy-static";
import { requestOrigin } from "@/lib/request-origin";
import {
  SESSION_EXPIRED_BODY,
  SESSION_EXPIRED_HEADER,
  SESSION_EXPIRED_VALUE,
} from "@/lib/session-expired-copy";
import { isToastBenchEnabled } from "@/lib/toast";
import { retoLinkGate } from "@/lib/juegos/retos/link-gate";
import { postgresRetoLinkLookup } from "@/lib/juegos/retos/link-lookup";
import { postgresRateLimitStore } from "@/lib/rate-limit-store";

const LOGIN_PATH = "/login";

const SIGNUP_PATH = "/registro";

// /api/cron authenticates itself with CRON_SECRET instead of a session. /api/poster-ambient
// is not here: each new path costs a TMDB fetch + sharp, so only signed-in users get it
// (FIL-I10-6 L6); its answers stay CDN-cached. /compartir pages check their own signed
// token (FIL-I15-4) and are read-only. /unirse shows a list invite before sign-in
// (FIL-I18-3): the page checks the link and the session itself. The MCP connector (FIL-I20)
// authenticates on its own: /api/mcp and /mcp check the bearer token, /api/oauth and
// /.well-known are the OAuth server (its consent POST checks the session and Origin itself).
// /conector is the connector's public guide (its OAuth service_documentation).
// /reto is a Mayor o menor challenge by link for people without an account (FIL-I53-4): the page
// checks its token itself, and opening it is rate-limited per IP right here.
// /oauth/consent is NOT here: it needs the Filmia session like any page.
export const PUBLIC_PATHS = [
  LOGIN_PATH,
  SIGNUP_PATH,
  "/api/auth",
  "/api/cron",
  "/compartir",
  "/unirse",
  "/api/mcp",
  "/mcp",
  "/api/oauth",
  "/.well-known",
  "/conector",
  "/reto",
];

export const isPublicPath = (pathname: string) => {
  // Dev-only cristal bench. It is not in PUBLIC_PATHS: production still asks for
  // a session, and the page calls notFound() outside development (FIL-I27-4).
  if (isToastBenchEnabled() && (pathname === "/alertas-sala" || pathname.startsWith("/alertas-sala/"))) {
    return true;
  }
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
};

export const proxy = async (request: Request) => {
  const { pathname } = new URL(request.url);

  // Static files, including /sw.js, never read the session. Otherwise a worker
  // update (and every splash PNG, if the matcher changes) pays for Neon — and
  // a signed-out check would redirect the worker script to /login.
  if (isProxyStaticAsset(pathname) || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const limited = await retoLinkGate(request, postgresRateLimitStore, postgresRetoLinkLookup);
  if (limited) {
    return limited;
  }

  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  const isAuthScreen = pathname === LOGIN_PATH || pathname === SIGNUP_PATH;
  const publicPath = isPublicPath(pathname);
  // Only requests whose answer depends on the session pay for the version lookup.
  const verified =
    token && (!publicPath || isAuthScreen)
      ? await verifySessionToken(decodeURIComponent(token))
      : null;
  // A password change bumps User.sessionVersion: older tokens stop working here (FIL-I10-3).
  const revoked = verified ? !(await isSessionCurrent(verified)) : false;
  const session = revoked ? null : verified;
  const loggedIn = Boolean(session?.id);
  // New accounts stay on /bienvenida until they finish or skip it (the claim is re-minted then).
  const gated = loggedIn && session?.onboarded === false;

  const respond = (response: NextResponse) => {
    if (revoked) {
      response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
    }
    return response;
  };

  if (publicPath) {
    if (loggedIn && isAuthScreen) {
      return NextResponse.redirect(
        new URL(
          gated ? onboardingHref(safeNextPath(new URL(request.url).searchParams.get("callbackUrl"))) : "/",
          requestOrigin(request),
        ),
      );
    }
    return respond(NextResponse.next());
  }

  // Redirect before any HTML so the launch loader is not painted on a bounce
  // from / to /login or /bienvenida. Server Functions POST to the page they
  // are used on, so /bienvenida itself must stay reachable.
  if (gated && pathname !== ONBOARDING_PATH && !pathname.startsWith("/api/")) {
    // FIL-41: keep where they were going (an MCP consent screen) so the Bienvenida returns there.
    const requestedUrl = new URL(request.url);
    requestedUrl.searchParams.delete("_rsc");
    const requested = safeNextPath(`${pathname}${requestedUrl.search}`);
    return NextResponse.redirect(new URL(onboardingHref(requested), requestOrigin(request)));
  }

  if (!loggedIn) {
    // A Server Action cannot follow a redirect to /login: the client would get an empty result
    // and show success (FIL-I41-18). Answer 401 in plain text so the action rejects and the page
    // can say «Sesión vencida».
    if (request.headers.has("next-action")) {
      return respond(
        new NextResponse(SESSION_EXPIRED_BODY, {
          status: 401,
          headers: { "content-type": "text/plain", [SESSION_EXPIRED_HEADER]: SESSION_EXPIRED_VALUE },
        }),
      );
    }
    const loginUrl = new URL(LOGIN_PATH, requestOrigin(request));
    const callbackPath = `${pathname}${new URL(request.url).search}`;
    if (callbackPath && callbackPath !== "/") {
      loginUrl.searchParams.set("callbackUrl", callbackPath);
    }
    return respond(NextResponse.redirect(loginUrl));
  }

  return NextResponse.next();
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|filmia-mark.png|sw\\.js|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)",
  ],
};
