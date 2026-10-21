import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { McpToolError } from "@/lib/mcp/errors";

/**
 * Opaque pagination cursors (FIL-I20-2): `offset` signed with AUTH_SECRET and bound to the
 * tool and its filters, so a cursor from another query (or a hand-edited one) is rejected.
 */

const secret = () => process.env.AUTH_SECRET?.trim() || "filmia-dev-cursor-secret";

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 22);

/** Stable fingerprint of a query: the tool name plus its filters (cursor and limit excluded). */
export const queryKey = (tool: string, filters: Record<string, unknown>) => {
  const relevant = Object.fromEntries(
    Object.entries(filters)
      .filter(([key, value]) => key !== "cursor" && key !== "limit" && value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return createHash("sha256").update(`${tool}:${JSON.stringify(relevant)}`).digest("base64url").slice(0, 12);
};

export const encodeCursor = (key: string, offset: number) => {
  const payload = `${key}.${offset}`;
  return Buffer.from(`${payload}.${sign(payload)}`).toString("base64url");
};

/** Offset for `key`, 0 without a cursor; `validation` for a forged or foreign cursor. */
export const decodeCursor = (key: string, cursor: string | undefined | null) => {
  if (!cursor) return 0;
  const invalid = new McpToolError("validation", "El cursor no es válido para esta consulta.", {
    hint: "Usa el next_cursor que devolvió la misma tool con los mismos filtros, o vuelve a empezar sin cursor.",
  });
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    throw invalid;
  }
  const [cursorKey, offsetText, signature] = decoded.split(".");
  if (!cursorKey || !offsetText || !signature) throw invalid;
  const expected = Buffer.from(sign(`${cursorKey}.${offsetText}`));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw invalid;
  if (cursorKey !== key) throw invalid;
  const offset = Number(offsetText);
  if (!Number.isInteger(offset) || offset < 0) throw invalid;
  return offset;
};

export type Page<T> = { items: T[]; next_cursor: string | null; total_count: number; limit: number };

/** Slices `all` (already filtered and sorted) into one page. */
export const paginate = <T>(all: T[], key: string, cursor: string | undefined, limit: number): Page<T> => {
  const offset = decodeCursor(key, cursor);
  const items = all.slice(offset, offset + limit);
  const next = offset + items.length;
  return {
    items,
    next_cursor: next < all.length ? encodeCursor(key, next) : null,
    total_count: all.length,
    limit,
  };
};
