import { createHash } from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { db, mcpIdempotencyKeys } from "@/db";
import { McpToolError } from "@/lib/mcp/errors";

/**
 * Idempotency for write tools that create rows (FIL-I20-5): the first answer to a key is
 * replayed for 24 h; the same key with other arguments is `validation`. A key is claimed with
 * an insert that does nothing on conflict, so of two concurrent retries only one runs.
 */

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export type IdempotencyStore = {
  /** Claims the key; null when it was free, the stored row otherwise. */
  claim: (row: { userId: string; key: string; tool: string; argsHash: string }, now: Date) => Promise<{
    tool: string;
    argsHash: string;
    response: unknown;
    createdAt: Date;
  } | null>;
  complete: (userId: string, key: string, response: unknown) => Promise<void>;
  release: (userId: string, key: string) => Promise<void>;
};

export const hashArgs = (tool: string, args: Record<string, unknown>) => {
  const relevant = Object.fromEntries(
    Object.entries(args)
      .filter(([key, value]) => key !== "idempotency_key" && value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return createHash("sha256").update(`${tool}:${JSON.stringify(relevant)}`).digest("hex");
};

export const postgresIdempotencyStore: IdempotencyStore = {
  claim: async (row, now) => {
    // An expired row is replaced; a live one is returned as is.
    await db
      .delete(mcpIdempotencyKeys)
      .where(
        and(
          eq(mcpIdempotencyKeys.userId, row.userId),
          eq(mcpIdempotencyKeys.key, row.key),
          lt(mcpIdempotencyKeys.createdAt, new Date(now.getTime() - IDEMPOTENCY_TTL_MS)),
        ),
      );
    const inserted = await db
      .insert(mcpIdempotencyKeys)
      .values({ ...row, createdAt: now })
      .onConflictDoNothing()
      .returning({ key: mcpIdempotencyKeys.key });
    if (inserted.length === 1) return null;
    const existing = await db.query.mcpIdempotencyKeys.findFirst({
      where: and(eq(mcpIdempotencyKeys.userId, row.userId), eq(mcpIdempotencyKeys.key, row.key)),
    });
    return existing ?? null;
  },
  complete: async (userId, key, response) => {
    await db
      .update(mcpIdempotencyKeys)
      .set({ response: sql`${JSON.stringify(response)}::jsonb` })
      .where(and(eq(mcpIdempotencyKeys.userId, userId), eq(mcpIdempotencyKeys.key, key)));
  },
  release: async (userId, key) => {
    await db
      .delete(mcpIdempotencyKeys)
      .where(and(eq(mcpIdempotencyKeys.userId, userId), eq(mcpIdempotencyKeys.key, key)));
  },
};

export const memoryIdempotencyStore = (): IdempotencyStore => {
  const rows = new Map<string, { tool: string; argsHash: string; response: unknown; createdAt: Date }>();
  return {
    claim: async (row, now) => {
      const id = `${row.userId}:${row.key}`;
      const existing = rows.get(id);
      if (existing && now.getTime() - existing.createdAt.getTime() < IDEMPOTENCY_TTL_MS) return existing;
      rows.set(id, { tool: row.tool, argsHash: row.argsHash, response: null, createdAt: now });
      return null;
    },
    complete: async (userId, key, response) => {
      const row = rows.get(`${userId}:${key}`);
      if (row) row.response = response;
    },
    release: async (userId, key) => {
      rows.delete(`${userId}:${key}`);
    },
  };
};

/**
 * Runs `create` once per (user, key). A replay returns the stored answer; a key reused with other
 * arguments, or one whose first call is still running, is an error. A failed first run frees the
 * key so the client can retry.
 */
export const withIdempotency = async <T>(
  store: IdempotencyStore,
  input: { userId: string; key: string; tool: string; args: Record<string, unknown>; now: Date },
  create: () => Promise<T>,
): Promise<T> => {
  const argsHash = hashArgs(input.tool, input.args);
  const existing = await store.claim({ userId: input.userId, key: input.key, tool: input.tool, argsHash }, input.now);
  if (existing) {
    if (existing.tool !== input.tool || existing.argsHash !== argsHash) {
      throw new McpToolError("validation", "Esa idempotency_key ya se usó para otra acción.", {
        hint: "Usa una clave nueva para cada acción distinta; reutilízala solo al reintentar la misma.",
      });
    }
    if (existing.response == null) {
      throw new McpToolError("validation", "Esa acción todavía se está procesando.", {
        hint: "Espera un momento y reintenta con la misma clave.",
      });
    }
    return existing.response as T;
  }
  try {
    const result = await create();
    await store.complete(input.userId, input.key, result);
    return result;
  } catch (error) {
    await store.release(input.userId, input.key).catch(() => undefined);
    throw error;
  }
};

export const sweepIdempotencyKeys = async (now: Date) => {
  const deleted = await db
    .delete(mcpIdempotencyKeys)
    .where(lt(mcpIdempotencyKeys.createdAt, new Date(now.getTime() - IDEMPOTENCY_TTL_MS)))
    .returning({ key: mcpIdempotencyKeys.key });
  return deleted.length;
};
