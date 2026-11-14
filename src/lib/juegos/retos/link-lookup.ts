import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { db, juegoRetos } from "@/db";
import type { RetoLinkLookup } from "@/lib/juegos/retos/link-gate";

/** The proxy's check for `/reto/<token>` (FIL-I53-4): one indexed read by the token's hash. */
export const postgresRetoLinkLookup: RetoLinkLookup = async (tokenHash, now) => {
  const row = await db.query.juegoRetos.findFirst({
    where: and(
      eq(juegoRetos.linkTokenHash, tokenHash),
      isNull(juegoRetos.toUserId),
      inArray(juegoRetos.status, ["abierto", "jugado"]),
      gt(juegoRetos.expiresAt, now),
    ),
    columns: { id: true },
  });
  return Boolean(row);
};
