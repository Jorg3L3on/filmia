import { NextResponse } from "next/server";
import { googleSignInConfig, oauthStateCookieOptions } from "@/lib/auth/google";
import {
  GOOGLE_OAUTH_COOKIE_NAME,
  buildGoogleAuthorizationUrl,
  encodeOAuthState,
  googleRedirectUri,
  loginErrorPath,
  pkceChallenge,
  randomToken,
  safeNextPath,
} from "@/lib/google-oauth";
import { publicOrigin, requestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/** Step 1: remember state + PKCE verifier in a short-lived cookie, send the user to Google. */
export const GET = async (request: Request) => {
  const config = googleSignInConfig();
  if (!config) {
    return NextResponse.redirect(
      new URL(loginErrorPath("disabled"), requestOrigin(request)),
      303,
    );
  }

  const next = safeNextPath(new URL(request.url).searchParams.get("next"));
  const state = randomToken();
  const verifier = randomToken(48);

  const authorizationUrl = buildGoogleAuthorizationUrl({
    clientId: config.clientId,
    redirectUri: googleRedirectUri(publicOrigin(request)),
    state,
    codeChallenge: await pkceChallenge(verifier),
  });

  const response = NextResponse.redirect(authorizationUrl, 303);
  response.cookies.set(
    GOOGLE_OAUTH_COOKIE_NAME,
    encodeOAuthState({ state, verifier, next }),
    oauthStateCookieOptions(),
  );
  return response;
};
