import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/session-token";

const LOGIN_PATH = "/login";

const requestOrigin = (request: Request) => {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin.replace("://0.0.0.0", "://127.0.0.1");
};

const SIGNUP_PATH = "/registro";

const PUBLIC_PATHS = [LOGIN_PATH, SIGNUP_PATH, "/api/auth", "/api/poster-ambient"];

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

const isStaticAsset = (pathname: string) =>
  pathname.startsWith("/_next/") ||
  pathname === "/favicon.ico" ||
  pathname === "/logo.png" ||
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

  if (isStaticAsset(pathname) || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    if (loggedIn && (pathname === LOGIN_PATH || pathname === SIGNUP_PATH)) {
      return NextResponse.redirect(new URL("/", requestOrigin(request)));
    }
    return NextResponse.next();
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
    "/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
