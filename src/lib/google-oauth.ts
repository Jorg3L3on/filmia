/**
 * Pure helpers for "Sign in with Google" (OAuth 2.0 authorization code + PKCE).
 * No Next.js or database imports so the module stays unit-testable.
 */

export const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
export const GOOGLE_SCOPES = "openid email profile";

/** Short-lived cookie holding the CSRF state + PKCE verifier between redirects. */
export const GOOGLE_OAUTH_COOKIE_NAME = "filmia.google-oauth";
export const GOOGLE_OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export const GOOGLE_SIGN_IN_ERRORS = [
  "disabled",
  "denied",
  "state",
  "token",
  "email",
] as const;

export type GoogleSignInErrorCode = (typeof GOOGLE_SIGN_IN_ERRORS)[number];

export class GoogleSignInError extends Error {
  readonly code: GoogleSignInErrorCode;

  constructor(code: GoogleSignInErrorCode, message?: string) {
    super(message ?? `Google sign-in failed: ${code}`);
    this.name = "GoogleSignInError";
    this.code = code;
  }
}

export type GoogleOAuthState = {
  state: string;
  verifier: string;
  next: string;
};

export type GoogleIdentity = {
  /** Stable Google account id (`sub` claim). */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

const base64Url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

export const randomToken = (bytes = 32) =>
  base64Url(crypto.getRandomValues(new Uint8Array(bytes)));

/** RFC 7636 S256 code challenge for a verifier. */
export const pkceChallenge = async (verifier: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64Url(new Uint8Array(digest));
};

/**
 * Where to land after signing in. Only same-origin paths; auth and API routes
 * fall back to the home screen so a stale `next` can't bounce the user around.
 */
export const safeNextPath = (value: string | null | undefined) => {
  if (!value) {
    return "/";
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  if (
    value === "/login" ||
    value.startsWith("/login/") ||
    value.startsWith("/login?") ||
    value === "/registro" ||
    value.startsWith("/registro/") ||
    value.startsWith("/registro?") ||
    value.startsWith("/api/")
  ) {
    return "/";
  }
  return value;
};

export const googleRedirectUri = (origin: string) =>
  `${origin.replace(/\/+$/, "")}/api/auth/google/callback`;

export const googleSignInHref = (next?: string | null) => {
  const target = safeNextPath(next);
  return target === "/"
    ? "/api/auth/google"
    : `/api/auth/google?next=${encodeURIComponent(target)}`;
};

export const loginErrorPath = (code: GoogleSignInErrorCode) =>
  `/login?error=google_${code}`;

type AuthorizationUrlInput = {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
};

export const buildGoogleAuthorizationUrl = ({
  clientId,
  redirectUri,
  state,
  codeChallenge,
}: AuthorizationUrlInput) => {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
};

export const encodeOAuthState = (value: GoogleOAuthState) =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

export const decodeOAuthState = (
  raw: string | null | undefined,
): GoogleOAuthState | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const { state, verifier, next } = parsed as Record<string, unknown>;
    if (typeof state !== "string" || !state) {
      return null;
    }
    if (typeof verifier !== "string" || !verifier) {
      return null;
    }
    return {
      state,
      verifier,
      next: safeNextPath(typeof next === "string" ? next : null),
    };
  } catch {
    return null;
  }
};

/** Shape-check the verified ID-token payload; the signature is checked elsewhere. */
export const parseGoogleIdTokenClaims = (
  payload: Record<string, unknown>,
): GoogleIdentity | null => {
  const sub = payload.sub;
  const email = payload.email;
  if (typeof sub !== "string" || !sub) {
    return null;
  }
  if (typeof email !== "string" || !email.includes("@")) {
    return null;
  }

  const emailVerified =
    payload.email_verified === true || payload.email_verified === "true";
  const name =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : null;

  return {
    sub,
    email: email.trim().toLowerCase(),
    emailVerified,
    name,
  };
};
