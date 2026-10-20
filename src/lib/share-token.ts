import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveAuthSecret } from "@/lib/auth/constants";

/**
 * Public share links (FIL-I15-4): `/compartir/<kind>/<id>.<sig>`. The
 * signature (HMAC of AUTH_SECRET, 132 bits) is what makes the page public: only
 * a review or list its owner chose to share has a link anyone can open, and a
 * bare Title or List id never is one. No table, no migration; rotating
 * AUTH_SECRET retires every link.
 */

export type ShareKind = "resena" | "lista" | "compat";

const SIG_LENGTH = 22;
const PART = "[a-z0-9]{8,40}";
/** A review or list is one id; a compat card (FIL-I19-4) is `list-userA-userB`. */
const ID_PATTERNS: Record<ShareKind, RegExp> = {
  resena: new RegExp(`^${PART}$`, "i"),
  lista: new RegExp(`^${PART}$`, "i"),
  compat: new RegExp(`^${PART}-${PART}-${PART}$`, "i"),
};

/** One id per pair and list, whoever shares it: the two users go in a fixed order. */
export const compatShareId = (listId: string, userA: string, userB: string) =>
  [listId, ...[userA, userB].sort()].join("-");

export const parseCompatShareId = (id: string) => {
  const [listId, userA, userB] = id.split("-");
  return listId && userA && userB ? { listId, userA, userB } : null;
};

const signature = (secret: string, kind: ShareKind, id: string) =>
  createHmac("sha256", secret)
    .update(`filmia-share:v1:${kind}:${id}`)
    .digest("base64url")
    .slice(0, SIG_LENGTH);

export const signShareToken = (kind: ShareKind, id: string, secret = resolveAuthSecret()) => {
  if (!secret) {
    throw new Error("AUTH_SECRET no está configurado.");
  }
  return `${id}.${signature(secret, kind, id)}`;
};

/** The id a valid token names, or null (wrong kind, tampered, malformed). */
export const verifyShareToken = (
  kind: ShareKind,
  token: string,
  secret = resolveAuthSecret(),
): string | null => {
  const [id, sig, ...rest] = decodeURIComponent(token).split(".");
  if (!secret || rest.length > 0 || !id || !sig || !ID_PATTERNS[kind].test(id) || sig.length !== SIG_LENGTH) {
    return null;
  }
  const expected = Buffer.from(signature(secret, kind, id));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
};

export const sharePath = (kind: ShareKind, id: string) =>
  `/compartir/${kind}/${signShareToken(kind, id)}`;
