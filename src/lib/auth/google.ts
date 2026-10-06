import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db, users } from "@/db";
import type { SessionUser } from "@/lib/auth/constants";
import {
  GOOGLE_ISSUERS,
  GOOGLE_JWKS_URL,
  GOOGLE_OAUTH_COOKIE_MAX_AGE_SECONDS,
  GOOGLE_TOKEN_ENDPOINT,
  GoogleSignInError,
  parseGoogleIdTokenClaims,
  type GoogleIdentity,
} from "@/lib/google-oauth";
import { ensureDefaultLists } from "@/lib/lists";
import { ensureDefaultTags } from "@/lib/tags";

export type GoogleSignInConfig = {
  clientId: string;
  clientSecret: string;
};

/** Both env vars present → the «Continuar con Google» button shows up. */
export const googleSignInConfig = (): GoogleSignInConfig | null => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }
  return { clientId, clientSecret };
};

export const isGoogleSignInEnabled = () => googleSignInConfig() !== null;

export const oauthStateCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/api/auth/google",
  secure: process.env.NODE_ENV === "production",
  maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE_SECONDS,
});

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

const googleJwks = () => {
  jwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  return jwks;
};

type ExchangeInput = {
  code: string;
  verifier: string;
  redirectUri: string;
};

/** Trade the authorization code for an ID token (we never need the access token). */
export const exchangeGoogleCode = async (
  { code, verifier, redirectUri }: ExchangeInput,
  config: GoogleSignInConfig,
) => {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new GoogleSignInError("token", `Token exchange failed (${response.status}).`);
  }

  const payload = (await response.json()) as { id_token?: unknown };
  if (typeof payload.id_token !== "string" || !payload.id_token) {
    throw new GoogleSignInError("token", "Token response has no id_token.");
  }

  return payload.id_token;
};

export const verifyGoogleIdToken = async (
  idToken: string,
  clientId: string,
): Promise<GoogleIdentity> => {
  let claims: Record<string, unknown>;
  try {
    const { payload } = await jwtVerify(idToken, googleJwks(), {
      issuer: GOOGLE_ISSUERS,
      audience: clientId,
    });
    claims = payload;
  } catch {
    throw new GoogleSignInError("token", "ID token did not verify.");
  }

  const identity = parseGoogleIdTokenClaims(claims);
  if (!identity) {
    throw new GoogleSignInError("token", "ID token is missing sub/email.");
  }
  if (!identity.emailVerified) {
    throw new GoogleSignInError("email");
  }

  return identity;
};

/**
 * Resolve the Filmia account for a verified Google identity:
 * 1. already linked by Google id;
 * 2. same email → link it (Google verified the address, so auto-link is safe);
 * 3. otherwise create a password-less account with the default lists and tags.
 */
export const findOrCreateGoogleUser = async (
  identity: GoogleIdentity,
): Promise<SessionUser> => {
  const linked = await db.query.users.findFirst({
    where: eq(users.googleId, identity.sub),
    columns: { id: true, email: true, name: true },
  });
  if (linked) {
    return linked;
  }

  const byEmail = await db.query.users.findFirst({
    where: eq(users.email, identity.email),
    columns: { id: true, email: true, name: true },
  });
  if (byEmail) {
    const name = byEmail.name ?? identity.name;
    await db
      .update(users)
      .set({ googleId: identity.sub, name })
      .where(eq(users.id, byEmail.id));
    return { id: byEmail.id, email: byEmail.email, name };
  }

  const id = createId();
  await db.insert(users).values({
    id,
    email: identity.email,
    googleId: identity.sub,
    name: identity.name,
    passwordHash: null,
  });
  await Promise.all([ensureDefaultLists(id), ensureDefaultTags(id)]);

  return { id, email: identity.email, name: identity.name };
};
