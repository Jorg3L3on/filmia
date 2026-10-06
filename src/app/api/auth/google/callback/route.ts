import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import {
  exchangeGoogleCode,
  findOrCreateGoogleUser,
  googleSignInConfig,
  oauthStateCookieOptions,
  verifyGoogleIdToken,
} from "@/lib/auth/google";
import {
  GOOGLE_OAUTH_COOKIE_NAME,
  GoogleSignInError,
  decodeOAuthState,
  googleRedirectUri,
  loginErrorPath,
  type GoogleSignInErrorCode,
} from "@/lib/google-oauth";
import { ONBOARDING_PATH } from "@/lib/onboarding/steps";
import { publicOrigin, requestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

const readCookie = (request: Request, name: string) =>
  request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);

const clearOAuthCookie = (response: NextResponse) => {
  response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, "", {
    ...oauthStateCookieOptions(),
    maxAge: 0,
  });
  return response;
};

/** Step 2: Google sends the user back with `code` + `state`; mint the Filmia session. */
export const GET = async (request: Request) => {
  const origin = requestOrigin(request);
  const fail = (code: GoogleSignInErrorCode) =>
    clearOAuthCookie(
      NextResponse.redirect(new URL(loginErrorPath(code), origin), 303),
    );

  const config = googleSignInConfig();
  if (!config) {
    return fail("disabled");
  }

  const params = new URL(request.url).searchParams;
  if (params.get("error")) {
    return fail("denied");
  }

  const stored = decodeOAuthState(
    readCookie(request, GOOGLE_OAUTH_COOKIE_NAME)
      ? decodeURIComponent(readCookie(request, GOOGLE_OAUTH_COOKIE_NAME)!)
      : null,
  );
  const code = params.get("code");
  const state = params.get("state");
  if (!stored || !code || !state || state !== stored.state) {
    return fail("state");
  }

  try {
    const idToken = await exchangeGoogleCode(
      {
        code,
        verifier: stored.verifier,
        redirectUri: googleRedirectUri(publicOrigin(request)),
      },
      config,
    );
    const identity = await verifyGoogleIdToken(idToken, config.clientId);
    const { user, onboarded } = await findOrCreateGoogleUser(identity);

    // Accounts that still owe the Bienvenida land there instead of the requested page.
    const response = clearOAuthCookie(
      NextResponse.redirect(new URL(onboarded ? stored.next : ONBOARDING_PATH, origin), 303),
    );
    await setSessionCookie(response, user, { onboarded });
    return response;
  } catch (error) {
    if (!(error instanceof GoogleSignInError)) {
      console.error("[auth/google] callback failed", error);
    }
    return fail(error instanceof GoogleSignInError ? error.code : "token");
  }
};
