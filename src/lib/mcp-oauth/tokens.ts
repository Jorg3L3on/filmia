import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  OAUTH_ACCESS_TOKEN_PREFIX,
  OAUTH_CODE_PREFIX,
  OAUTH_REFRESH_TOKEN_PREFIX,
  PERSONAL_TOKEN_PREFIX,
  TOKEN_LOOKUP_LENGTH,
} from "@/lib/mcp-oauth/config";

const SHA256_PREFIX = "sha256:";

export type GeneratedSecret = {
  /** Shown once (to the client or the person); never stored. */
  token: string;
  /** Stored in clear for the lookup. */
  tokenPrefix: string;
  tokenHash: string;
};

export const hashSecret = (secret: string) =>
  `${SHA256_PREFIX}${createHash("sha256").update(secret).digest("hex")}`;

export const verifySecret = (secret: string, storedHash: string) => {
  if (!storedHash.startsWith(SHA256_PREFIX)) return false;
  const expected = Buffer.from(storedHash.slice(SHA256_PREFIX.length), "hex");
  const actual = createHash("sha256").update(secret).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const generate = (prefix: string): GeneratedSecret => {
  const token = `${prefix}${randomBytes(32).toString("base64url")}`;
  return { token, tokenPrefix: token.slice(0, TOKEN_LOOKUP_LENGTH), tokenHash: hashSecret(token) };
};

export const generateAccessToken = () => generate(OAUTH_ACCESS_TOKEN_PREFIX);
export const generateRefreshToken = () => generate(OAUTH_REFRESH_TOKEN_PREFIX);
export const generateAuthorizationCode = () => generate(OAUTH_CODE_PREFIX);
export const generatePersonalToken = () => generate(PERSONAL_TOKEN_PREFIX);

export const generateClientSecret = () => randomBytes(32).toString("base64url");

/** RFC 7636: 43–128 characters of the unreserved set. */
export const isValidPkceVerifier = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9\-._~]{43,128}$/.test(value);

export const isValidPkceChallenge = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9\-_]{43}$/.test(value);

export const pkceChallengeFor = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");

export const verifyPkceS256 = (verifier: string, challenge: string) => {
  const expected = Buffer.from(challenge);
  const actual = Buffer.from(pkceChallengeFor(verifier));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
