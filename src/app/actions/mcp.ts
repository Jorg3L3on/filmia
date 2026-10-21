"use server";

import { revalidatePath } from "next/cache";
import { revokeUserGrant } from "@/lib/mcp/connections";
import { issuePersonalToken, type NewPersonalToken } from "@/lib/mcp/personal-tokens";
import { isMcpEnabled } from "@/lib/mcp-oauth/config";
import { oauthDeps } from "@/lib/mcp-oauth/deps";
import { postgresRateLimitStore } from "@/lib/rate-limit-store";
import { requireUserId } from "@/lib/session";

/** Perfil → Conexiones (FIL-I20-6). Every action acts on the signed-in person's own credentials. */

const CONNECTIONS_PATH = "/perfil/conexiones";

export const createMcpToken = async (input: {
  name: string;
  days: number;
  allowWrite: boolean;
}): Promise<NewPersonalToken> => {
  const userId = await requireUserId();
  if (!isMcpEnabled()) return { ok: false, code: "validation", error: "El conector no está activo." };
  const result = await issuePersonalToken({ ...oauthDeps, rateLimit: postgresRateLimitStore }, userId, input);
  if (result.ok) revalidatePath(CONNECTIONS_PATH);
  return result;
};

export const revokeMcpGrant = async (grantId: string) => {
  const userId = await requireUserId();
  const revoked = await revokeUserGrant(userId, grantId);
  revalidatePath(CONNECTIONS_PATH);
  return { ok: revoked };
};

export const revokeMcpToken = async (tokenId: string) => {
  const userId = await requireUserId();
  const revoked = await oauthDeps.store.revokePersonalTokens({ id: tokenId, userId }, new Date());
  revalidatePath(CONNECTIONS_PATH);
  return { ok: revoked === 1 };
};
