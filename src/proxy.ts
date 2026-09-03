import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

const LOGIN_PATH = "/login";
const SIGNUP_PATH = "/registro";

const PUBLIC_PATHS = [
  LOGIN_PATH,
  SIGNUP_PATH,
  "/api/auth",
];

const SESSION_COOKIE_NAMES = [
  SESSION_COOKIE_NAME,
  `__Secure-${SESSION_COOKIE_NAME}`,
  "__Secure-authjs.session-token",
  "authjs.session-token",
];

const hasSessionCookie = (request: NextRequest) =>
  SESSION_COOKIE_NAMES.some((name) => Boolean(request.cookies.get(name)?.value));

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

const isStaticAsset = (pathname: string) =>
  pathname.startsWith("/_next/") ||
  pathname === "/favicon.ico" ||
  pathname === "/logo.png" ||
  pathname.startsWith("/posters/");

export const proxy = (request: NextRequest) => {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const loggedIn = hasSessionCookie(request);

  if (isPublicPath(pathname)) {
    if (loggedIn && (pathname === LOGIN_PATH || pathname === SIGNUP_PATH)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!loggedIn) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    const callbackPath = `${pathname}${request.nextUrl.search}`;
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
