import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db, mcpToolCalls } from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";
import type { McpToolCall } from "@/lib/mcp/define-tool";

/** McpToolCall rows past this are deleted by the daily cleanup (FIL-I20-6). */
export const TOOL_CALL_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type ToolCallRow = {
  userId: string;
  source: string;
  connectionId: string;
  tool: string;
  ok: boolean;
  errorCode: string | null;
  durationMs: number;
};

export const toToolCallRow = (call: McpToolCall): ToolCallRow => ({
  userId: call.connection.userId,
  source: call.connection.source,
  connectionId: call.connection.connectionId,
  tool: call.tool,
  ok: call.ok,
  errorCode: call.errorCode,
  durationMs: call.durationMs,
});

export const insertToolCall = async (row: ToolCallRow) => {
  await db.insert(mcpToolCalls).values({ id: createId(), ...row });
};

/**
 * `McpToolDeps.recordCall` for production: written after the response, so a failing insert
 * never changes (or delays) what the tool answered.
 */
export const recordToolCallAfterResponse = async (call: McpToolCall) => {
  scheduleAfterResponse(async () => {
    try {
      await insertToolCall(toToolCallRow(call));
    } catch (error) {
      console.error("[mcp] activity not recorded", error);
    }
  });
};

/** The latest calls of the given connections, newest first (Perfil → Conexiones). */
export const recentToolCalls = async (userId: string, connectionIds: string[], perConnection = 20) => {
  if (connectionIds.length === 0) return new Map<string, (typeof mcpToolCalls.$inferSelect)[]>();
  const rows = await db
    .select()
    .from(mcpToolCalls)
    .where(and(eq(mcpToolCalls.userId, userId), inArray(mcpToolCalls.connectionId, connectionIds)))
    .orderBy(desc(mcpToolCalls.createdAt))
    .limit(perConnection * connectionIds.length);
  const byConnection = new Map<string, (typeof mcpToolCalls.$inferSelect)[]>();
  for (const row of rows) {
    const list = byConnection.get(row.connectionId) ?? [];
    if (list.length < perConnection) list.push(row);
    byConnection.set(row.connectionId, list);
  }
  return byConnection;
};

export const sweepToolCalls = async (now: Date) => {
  const deleted = await db
    .delete(mcpToolCalls)
    .where(lt(mcpToolCalls.createdAt, new Date(now.getTime() - TOOL_CALL_RETENTION_MS)))
    .returning({ id: mcpToolCalls.id });
  return deleted.length;
};
