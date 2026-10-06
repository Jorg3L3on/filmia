import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/session-token";
import { ONBOARDING_PATH } from "@/lib/onboarding/steps";
import { requestOrigin } from "@/lib/request-origin";

const LOGIN_PATH = "/login";

const SIGNUP_PATH = "/registro";

// /api/cron authenticates itself with CRON_SECRET instead of a session.
const PUBLIC_PATHS = [
  LOGIN_PATH,
  SIGNUP_PATH,
  "/api/auth",
  "/api/poster-ambient",
  "/api/cron",
];

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

const isStaticAsset = (pathname: string) =>
  pathname.startsWith("/_next/") ||
  pathname === "/favicon.ico" ||
  pathname === "/filmia-mark.png" ||
  pathname === "/manifest.webmanifest" ||
  pathname === "/manifest.webmanifest/" ||
  pathname.startsWith("/icon-") ||
  pathname.startsWith("/posters/");

export const proxy = async (request: Request) => {
  const { pathname } = new URL(request.url);
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  const session = token ? await verifySessionToken(decodeURIComponent(token)) : null;
  const loggedIn = Boolean(session?.id);
  // New accounts stay on /bienvenida until they finish or skip it (the claim is re-minted then).
  const gated = loggedIn && session?.onboarded === false;

  if (isStaticAsset(pathname) || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    if (loggedIn && (pathname === LOGIN_PATH || pathname === SIGNUP_PATH)) {
      return NextResponse.redirect(
        new URL(gated ? ONBOARDING_PATH : "/", requestOrigin(request)),
      );
    }
    return NextResponse.next();
  }

  // Server Functions POST to the page they are used on, so /bienvenida itself must stay reachable.
  if (gated && pathname !== ONBOARDING_PATH && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL(ONBOARDING_PATH, requestOrigin(request)));
  }

  if (!loggedIn) {
    const loginUrl = new URL(LOGIN_PATH, requestOrigin(request));
    const callbackPath = `${pathname}${new URL(request.url).search}`;
    if (callbackPath && callbackPath !== "/") {
      loginUrl.searchParams.set("callbackUrl", callbackPath);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|filmia-mark.png|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
