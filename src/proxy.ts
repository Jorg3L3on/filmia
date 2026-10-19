import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { sessionCookieOptions, verifySessionToken } from "@/lib/auth/session-token";
import { isSessionCurrent } from "@/lib/auth/session-version";
import { ONBOARDING_PATH } from "@/lib/onboarding/steps";
import { isProxyStaticAsset } from "@/lib/proxy-static";
import { requestOrigin } from "@/lib/request-origin";

const LOGIN_PATH = "/login";

const SIGNUP_PATH = "/registro";

// /api/cron authenticates itself with CRON_SECRET instead of a session. /api/poster-ambient
// is not here: each new path costs a TMDB fetch + sharp, so only signed-in users get it
// (FIL-I10-6 L6); its answers stay CDN-cached. /compartir pages check their own signed
// token (FIL-I15-4) and are read-only.
const PUBLIC_PATHS = [LOGIN_PATH, SIGNUP_PATH, "/api/auth", "/api/cron", "/compartir"];

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

export const proxy = async (request: Request) => {
  const { pathname } = new URL(request.url);

  // Static files, including /sw.js, never read the session. Otherwise a worker
  // update (and every splash PNG, if the matcher changes) pays for Neon — and
  // a signed-out check would redirect the worker script to /login.
  if (isProxyStaticAsset(pathname) || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
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
        new URL(gated ? ONBOARDING_PATH : "/", requestOrigin(request)),
      );
    }
    return respond(NextResponse.next());
  }

  // Redirect before any HTML so the launch loader is not painted on a bounce
  // from / to /login or /bienvenida. Server Functions POST to the page they
  // are used on, so /bienvenida itself must stay reachable.
  if (gated && pathname !== ONBOARDING_PATH && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL(ONBOARDING_PATH, requestOrigin(request)));
  }

  if (!loggedIn) {
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
