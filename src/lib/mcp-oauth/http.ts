import { z } from "zod";
import {
  getIssuer,
  getMcpResourceUrl,
  isMcpEnabled,
  isOwnMcpResource,
  MCP_RESOURCE_ALIAS_PATH,
  MCP_RESOURCE_PATH,
  normalizeMcpResource,
} from "@/lib/mcp-oauth/config";
import {
  classifyClientId,
  impersonatesKnownClient,
  isRedirectUriAllowedFor,
} from "@/lib/mcp-oauth/clients";
import {
  authorizationServerMetadata,
  protectedResourceMetadata,
} from "@/lib/mcp-oauth/metadata";
import {
  createAuthorizationCode,
  exchangeAuthorizationCode,
  OAuthInvalidGrantError,
  refreshGrant,
  registerClient,
  registrationSchema,
  resolveClient,
  revokeToken,
  verifyClientSecret,
  type OAuthDeps,
} from "@/lib/mcp-oauth/service";
import type { ClientRecord } from "@/lib/mcp-oauth/store";
import { isValidPkceChallenge, isValidPkceVerifier } from "@/lib/mcp-oauth/tokens";
import {
  RATE_LIMITS,
  checkRateLimit,
  clientIp,
  type RateLimitRule,
  type RateLimitStore,
} from "@/lib/rate-limit";

/**
 * HTTP side of the OAuth server: parse, rate-limit, answer in the OAuth error shape. Each
 * route file under src/app wires one of these to the production dependencies (`deps.ts`).
 */

export type OAuthHttpDeps = {
  oauth: OAuthDeps;
  rateLimit: RateLimitStore;
  /** The signed-in, non-revoked Filmia user, or null. */
  sessionUserId: () => Promise<string | null>;
  env?: Record<string, string | undefined>;
};

// --- Responses -------------------------------------------------------------------------------

/** Discovery and the OAuth endpoints carry no cookies, so any origin may read them. */
export const OAUTH_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, mcp-protocol-version",
  "Access-Control-Max-Age": "86400",
};

const withCors = (headers: HeadersInit = {}) => {
  const merged = new Headers(headers);
  for (const [key, value] of Object.entries(OAUTH_CORS_HEADERS)) merged.set(key, value);
  return merged;
};

export const oauthJson = (body: unknown, init: ResponseInit = {}) => {
  const headers = withCors(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
};

export const oauthError = (error: string, description?: string, status = 400, headers?: HeadersInit) =>
  oauthJson({ error, ...(description ? { error_description: description } : {}) }, { status, headers });

export const oauthOptions = () => new Response(null, { status: 204, headers: withCors() });

/** The connector is off: every MCP, OAuth and discovery route answers like it does not exist. */
export const mcpDisabledResponse = () => new Response("Not Found", { status: 404 });

const tooManyRequests = (retryAfterSeconds: number) =>
  oauthError("temporarily_unavailable", "Demasiadas solicitudes. Inténtalo más tarde.", 429, {
    "Retry-After": String(retryAfterSeconds),
  });

const redirectTo = (url: URL | string) =>
  new Response(null, { status: 302, headers: withCors({ Location: url.toString(), "Cache-Control": "no-store" }) });

const limit = async (deps: OAuthHttpDeps, rule: RateLimitRule, request: Request) => {
  try {
    return await checkRateLimit(deps.rateLimit, [{ rule, subject: clientIp(request.headers) }]);
  } catch (error) {
    // Same policy as the auth endpoints: an unreachable store fails open (and logs).
    console.error("[mcp-oauth] rate limit store unavailable", error);
    return { ok: true } as const;
  }
};

const enabled = (deps: OAuthHttpDeps) => isMcpEnabled(deps.env ?? process.env);

const cimdGate = (deps: OAuthHttpDeps, request: Request) => async () =>
  (await limit(deps, RATE_LIMITS.oauthCimdIp, request)).ok;

// --- Discovery -------------------------------------------------------------------------------

export const handleProtectedResourceMetadata = (deps: OAuthHttpDeps) =>
  enabled(deps)
    ? oauthJson(protectedResourceMetadata(), { headers: { "Cache-Control": "public, max-age=3600" } })
    : mcpDisabledResponse();

export const handleAuthorizationServerMetadata = (deps: OAuthHttpDeps) =>
  enabled(deps)
    ? oauthJson(authorizationServerMetadata(), { headers: { "Cache-Control": "public, max-age=3600" } })
    : mcpDisabledResponse();

// --- /authorize ------------------------------------------------------------------------------

const REQUIRED_AUTHORIZE_PARAMS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
] as const;

export const CONSENT_PATH = "/oauth/consent";

/**
 * Validates the request, then sends the browser to the consent page (behind the Filmia
 * session; the proxy sends signed-out people to /login and back). Errors before the
 * redirect_uri is validated are shown here, never redirected to an unchecked URI.
 */
export const handleAuthorize = async (deps: OAuthHttpDeps, request: Request) => {
  if (!enabled(deps)) return mcpDisabledResponse();
  const params = new URL(request.url).searchParams;
  const missing = REQUIRED_AUTHORIZE_PARAMS.filter((name) => !params.get(name));
  if (missing.length > 0) return oauthError("invalid_request", `Faltan parámetros: ${missing.join(", ")}`);
  if (params.get("response_type") !== "code") {
    return oauthError("unsupported_response_type", "Solo se admite response_type=code");
  }
  if (params.get("code_challenge_method") !== "S256" || !isValidPkceChallenge(params.get("code_challenge"))) {
    return oauthError("invalid_request", "PKCE S256 obligatorio");
  }

  const client = await resolveClient(deps.oauth, params.get("client_id")!, { canFetch: cimdGate(deps, request) });
  if (!client) return oauthError("invalid_client", "Cliente OAuth desconocido");
  const redirectUri = params.get("redirect_uri")!;
  if (!isRedirectUriAllowedFor(client, redirectUri)) {
    return oauthError("invalid_request", "redirect_uri no autorizado para este cliente");
  }

  const requested = params.get("resource");
  if (requested && !isOwnMcpResource(requested)) {
    const back = new URL(redirectUri);
    back.searchParams.set("error", "invalid_target");
    back.searchParams.set("error_description", "resource debe ser la URL del servidor MCP de Filmia");
    const state = params.get("state");
    if (state) back.searchParams.set("state", state);
    back.searchParams.set("iss", getIssuer());
    return redirectTo(back);
  }

  const consent = new URL(CONSENT_PATH, getIssuer());
  for (const name of [...REQUIRED_AUTHORIZE_PARAMS, "state", "scope"] as const) {
    const value = params.get(name);
    if (value) consent.searchParams.set(name, value);
  }
  consent.searchParams.set("resource", normalizeMcpResource(requested ?? getMcpResourceUrl()));
  return redirectTo(consent);
};

// --- Consent ---------------------------------------------------------------------------------

export const consentRequestSchema = z.object({
  client_id: z.string().min(1).max(2048),
  redirect_uri: z.string().min(1).max(2048),
  state: z.string().max(2048).optional(),
  code_challenge: z.string().refine(isValidPkceChallenge),
  code_challenge_method: z.literal("S256"),
  resource: z.string().max(2048).optional(),
});

export type ConsentRequest = z.infer<typeof consentRequestSchema>;

export type ConsentCheck =
  | { ok: true; client: ClientRecord; request: ConsentRequest; resource: string }
  | { ok: false; error: "invalid_request" | "invalid_client" | "invalid_target"; message: string };

/** Shared by the consent page (GET) and its POST: the same request, re-validated. */
export const checkConsentRequest = async (
  deps: OAuthHttpDeps,
  raw: Record<string, unknown>,
  canFetch?: () => Promise<boolean>,
): Promise<ConsentCheck> => {
  const parsed = consentRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_request", message: "Solicitud de conexión inválida." };
  const request = parsed.data;
  const client = await resolveClient(deps.oauth, request.client_id, { canFetch });
  if (!client) return { ok: false, error: "invalid_client", message: "No reconocemos esta app." };
  if (!isRedirectUriAllowedFor(client, request.redirect_uri)) {
    return { ok: false, error: "invalid_request", message: "La dirección de regreso no es válida para esta app." };
  }
  // RFC 8707: absent resource means this MCP server; any other is rejected.
  if (request.resource && !isOwnMcpResource(request.resource)) {
    return { ok: false, error: "invalid_target", message: "Esta conexión pide acceso a otro servidor." };
  }
  return { ok: true, client, request, resource: normalizeMcpResource(request.resource ?? getMcpResourceUrl()) };
};

const originOf = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

/**
 * The consent POST mints a code, so it must come from our own page: Origin equal to the issuer,
 * or no Origin and Sec-Fetch-Site same-origin. Anything else is a cross-site post (CSRF).
 */
export const isSameOriginPost = (request: Request) => {
  const origin = request.headers.get("origin");
  if (origin) return origin === originOf(getIssuer());
  return request.headers.get("sec-fetch-site") === "same-origin";
};

const consentBodySchema = z.object({
  decision: z.enum(["allow", "deny"]),
  /** Anything but the JSON boolean `true` (a string "true" included) means read only. */
  allow_write: z.unknown().optional(),
});

const callbackUrl = (redirectUri: string, values: Record<string, string | undefined>) => {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  url.searchParams.set("iss", getIssuer());
  return url.toString();
};

/**
 * POST /api/oauth/consent (JSON from the consent page). Answers `{ redirect_to }` and the page
 * navigates there: a form POST could not redirect off-site under `form-action 'self'`.
 * Write access is granted only when `allow_write` is exactly true.
 */
export const handleConsentPost = async (deps: OAuthHttpDeps, request: Request) => {
  if (!enabled(deps)) return mcpDisabledResponse();
  if (!isSameOriginPost(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const userId = await deps.sessionUserId();
  if (!userId) return Response.json({ error: "Tu sesión terminó. Entra de nuevo." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const decision = consentBodySchema.safeParse(body);
  if (!decision.success) return Response.json({ error: "Solicitud inválida." }, { status: 400 });

  try {
    const check = await checkConsentRequest(deps, body);
    if (!check.ok) {
      return Response.json(
        check.error === "invalid_target"
          ? { error: "invalid_target", error_description: check.message }
          : { error: check.message },
        { status: 400 },
      );
    }
    const { client, request: consent, resource } = check;

    if (decision.data.decision === "deny") {
      return Response.json({
        redirect_to: callbackUrl(consent.redirect_uri, { error: "access_denied", state: consent.state }),
      });
    }

    const code = await createAuthorizationCode(deps.oauth, {
      clientId: client.id,
      userId,
      redirectUri: consent.redirect_uri,
      codeChallenge: consent.code_challenge,
      resource,
      allowWrite: decision.data.allow_write === true,
    });
    return Response.json({ redirect_to: callbackUrl(consent.redirect_uri, { code, state: consent.state }) });
  } catch (error) {
    // Never echo internal messages (database, etc.) to the browser.
    console.error("[mcp-oauth] consent failed", error);
    return Response.json({ error: "No se pudo autorizar la conexión." }, { status: 500 });
  }
};

// --- /register -------------------------------------------------------------------------------

export const handleRegister = async (deps: OAuthHttpDeps, request: Request) => {
  if (!enabled(deps)) return mcpDisabledResponse();
  const check = await limit(deps, RATE_LIMITS.oauthRegisterIp, request);
  if (!check.ok) return tooManyRequests(check.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return oauthError("invalid_client_metadata", "JSON inválido");
  }
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    // RFC 7591 §3.2.2: bad redirect URIs get their own error code.
    const badRedirect = parsed.error.issues.some((issue) => issue.path[0] === "redirect_uris");
    return oauthError(
      badRedirect ? "invalid_redirect_uri" : "invalid_client_metadata",
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
    );
  }
  if (parsed.data.client_name && impersonatesKnownClient(parsed.data.client_name)) {
    return oauthError("invalid_client_metadata", "client_name no permitido");
  }

  try {
    const { client, clientSecret } = await registerClient(deps.oauth, parsed.data);
    return oauthJson(
      {
        client_id: client.id,
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        grant_types: client.grantTypes,
        response_types: client.responseTypes,
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
        ...(client.clientUri ? { client_uri: client.clientUri } : {}),
        ...(client.logoUri ? { logo_uri: client.logoUri } : {}),
        ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
        client_id_issued_at: Math.floor(deps.oauth.now().getTime() / 1000),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[mcp-oauth] registration failed", error);
    return oauthError("server_error", "No se pudo registrar el cliente", 500);
  }
};

// --- /token ----------------------------------------------------------------------------------

const readForm = async (request: Request): Promise<Record<string, string>> => {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(json).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  }
  const form = new URLSearchParams(await request.text());
  return Object.fromEntries(form.entries());
};

const resourceKind = (resource: string | undefined) => {
  if (!resource) return "absent";
  try {
    const path = new URL(resource).pathname.replace(/\/+$/, "");
    if (!isOwnMcpResource(resource)) return "other";
    return path === MCP_RESOURCE_ALIAS_PATH ? "mcp_alias" : path === MCP_RESOURCE_PATH ? "api_mcp" : "other";
  } catch {
    return "other";
  }
};

/**
 * POST /api/oauth/token. One attempt row per POST that got past the rate limit, written once
 * the outcome is known (no secrets: which fields came and how it ended).
 */
export const handleToken = async (deps: OAuthHttpDeps, request: Request) => {
  if (!enabled(deps)) return mcpDisabledResponse();
  const check = await limit(deps, RATE_LIMITS.oauthTokenIp, request);
  if (!check.ok) return tooManyRequests(check.retryAfterSeconds);

  let form: Record<string, string> = {};
  const finish = async (response: Response, error: string, reason: string | null = null) => {
    await deps.oauth.store
      .recordTokenAttempt({
        grantType: form.grant_type?.slice(0, 40) || null,
        clientIdKind: classifyClientId(form.client_id),
        hasCode: Boolean(form.code),
        hasVerifier: isValidPkceVerifier(form.code_verifier),
        hasAssertion: Boolean(form.client_assertion),
        resourceKind: resourceKind(form.resource),
        error,
        invalidGrantReason: reason,
        httpStatus: response.status,
      })
      .catch((failure) => console.error("[mcp-oauth] token attempt not recorded", failure));
    return response;
  };

  try {
    form = await readForm(request);
  } catch {
    return finish(oauthError("invalid_request", "Cuerpo inválido"), "invalid_request");
  }

  const grantType = form.grant_type;
  if (grantType !== "authorization_code" && grantType !== "refresh_token") {
    return finish(oauthError("unsupported_grant_type"), "unsupported_grant_type");
  }
  if (!form.client_id) return finish(oauthError("invalid_request", "Falta client_id"), "invalid_request");

  try {
    const client = await resolveClient(deps.oauth, form.client_id, { canFetch: cimdGate(deps, request) });
    if (!client || !verifyClientSecret(client, form.client_secret)) {
      // RFC 6749 §5.2.
      return finish(
        oauthError("invalid_client", undefined, 401, { "WWW-Authenticate": 'Basic realm="oauth"' }),
        "invalid_client",
      );
    }

    if (grantType === "authorization_code") {
      if (!form.code || !form.redirect_uri) {
        return finish(oauthError("invalid_request", "Faltan code o redirect_uri"), "invalid_request");
      }
      // PKCE always; a client_assertion is ignored and never stands in for the verifier.
      if (!isValidPkceVerifier(form.code_verifier)) {
        return finish(oauthError("invalid_grant", "code_verifier requerido (PKCE S256)"), "invalid_grant", "pkce");
      }
      const tokens = await exchangeAuthorizationCode(deps.oauth, {
        code: form.code,
        clientId: form.client_id,
        redirectUri: form.redirect_uri,
        codeVerifier: form.code_verifier,
        resource: form.resource || null,
      });
      return finish(oauthJson(tokens), "ok");
    }

    if (!form.refresh_token) return finish(oauthError("invalid_request", "Falta refresh_token"), "invalid_request");
    const tokens = await refreshGrant(deps.oauth, {
      refreshToken: form.refresh_token,
      clientId: form.client_id,
      resource: form.resource || null,
    });
    return finish(oauthJson(tokens), "ok");
  } catch (error) {
    if (error instanceof OAuthInvalidGrantError) {
      return finish(
        oauthError(error.reason === "resource" ? "invalid_target" : "invalid_grant"),
        "invalid_grant",
        error.reason,
      );
    }
    console.error("[mcp-oauth] token failed", error);
    return finish(oauthError("server_error", undefined, 500), "server_error");
  }
};

// --- /revoke ---------------------------------------------------------------------------------

export const handleRevoke = async (deps: OAuthHttpDeps, request: Request) => {
  if (!enabled(deps)) return mcpDisabledResponse();
  const check = await limit(deps, RATE_LIMITS.oauthTokenIp, request);
  if (!check.ok) return tooManyRequests(check.retryAfterSeconds);
  try {
    const form = await readForm(request);
    if (!form.token) return oauthError("invalid_request", "Falta token");
    await revokeToken(deps.oauth, form.token);
    return new Response(null, { status: 200, headers: withCors() });
  } catch (error) {
    console.error("[mcp-oauth] revoke failed", error);
    return oauthError("server_error", undefined, 500);
  }
};

