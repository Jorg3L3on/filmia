import type { McpServer, ServerContext, ToolAnnotations } from "@modelcontextprotocol/server";
import { z } from "zod";
import { McpToolError, toErrorBody, type McpErrorCode } from "@/lib/mcp/errors";
import type { IdempotencyStore } from "@/lib/mcp/idempotency";
import type { McpConnection } from "@/lib/mcp-oauth/service";
import { RATE_LIMITS, checkRateLimit, type RateLimitStore } from "@/lib/rate-limit";

/**
 * One way to declare an MCP tool (FIL-I20-2, the MIC-I6 `defineOwnerTool` idea). Every tool:
 * strict input (unknown keys are `validation`), an output schema with `structuredContent`,
 * truthful annotations, `openWorldHint: false`, the person from the connection (never an
 * argument), the per-connection rate limit before any query, writes gated by «Permitir
 * cambios», and errors from the allow-list in `errors.ts`.
 */

export type ToolScope = "read" | "write";

export type McpToolCall = {
  connection: McpConnection;
  tool: string;
  ok: boolean;
  errorCode: McpErrorCode | null;
  durationMs: number;
};

export type McpToolDeps = {
  rateLimit: RateLimitStore;
  /** Replays of write tools that create rows (FIL-I20-5). */
  idempotency: IdempotencyStore;
  now: () => Date;
  /** Server log; never sent to the client. */
  log: (event: string, data: Record<string, unknown>) => void;
  /** Activity log (FIL-I20-6), written after the response; a failure never changes it. */
  recordCall?: (call: McpToolCall) => Promise<void>;
};

export type ToolContext = {
  userId: string;
  connection: McpConnection;
  now: Date;
  deps: McpToolDeps;
};

type Shape = z.ZodRawShape;

export type ToolDefinition<I extends Shape = Shape, O extends Shape = Shape> = {
  name: string;
  title: string;
  description: string;
  scope: ToolScope;
  input: I;
  output: O;
  /** Only what differs from the defaults (readOnlyHint from scope, openWorldHint false). */
  annotations?: Pick<ToolAnnotations, "destructiveHint" | "idempotentHint">;
  meta?: Record<string, unknown>;
  run: (ctx: ToolContext, args: z.infer<z.ZodObject<I>>) => Promise<z.infer<z.ZodObject<O>>>;
};

/** Identity with inference: `defineTool({...})` types `run` from `input` and `output`. */
export const defineTool = <I extends Shape, O extends Shape>(definition: ToolDefinition<I, O>) =>
  definition as unknown as ToolDefinition;

export const toolAnnotations = (definition: ToolDefinition): ToolAnnotations => ({
  title: definition.title,
  readOnlyHint: definition.scope === "read",
  destructiveHint: definition.scope === "write" ? (definition.annotations?.destructiveHint ?? false) : false,
  idempotentHint: definition.annotations?.idempotentHint ?? definition.scope === "read",
  openWorldHint: false,
});

/**
 * The SDK validates `inputSchema` before our handler runs and answers with its own text. We
 * advertise the strict JSON Schema but validate ourselves, so a bad argument comes back as a
 * `validation` error in the same shape as every other error.
 */
const advertiseOnly = (schema: z.ZodType) => {
  const standard = schema["~standard"];
  return {
    "~standard": {
      ...standard,
      validate: (value: unknown) => ({ value }),
    },
  } as typeof schema;
};

type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
};

const ok = (data: Record<string, unknown>): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
  structuredContent: data,
});

const fail = (body: ReturnType<typeof toErrorBody>, meta?: Record<string, unknown>): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(body) }],
  isError: true,
  ...(meta ? { _meta: meta } : {}),
});

const connectionFrom = (ctx: ServerContext): McpConnection | null => {
  const extra = ctx.http?.authInfo?.extra as { connection?: McpConnection } | undefined;
  return extra?.connection ?? null;
};

/** Runs one tool call with every rule of the contract; exported for tests. */
export const executeTool = async (
  definition: ToolDefinition,
  deps: McpToolDeps,
  connection: McpConnection | null,
  rawArgs: unknown,
): Promise<ToolResult> => {
  const started = Date.now();
  let errorCode: McpErrorCode | null = null;
  const logError = (error: unknown) =>
    deps.log("mcp.tool.internal_error", {
      tool: definition.name,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

  try {
    if (!connection) throw new McpToolError("unauthorized", "Esta conexión ya no es válida. Vuelve a conectar Filmia.");

    const limited = await checkRateLimit(deps.rateLimit, [
      { rule: RATE_LIMITS.mcpConnection, subject: connection.connectionId },
    ]).catch((error) => {
      deps.log("mcp.rate_limit.unavailable", { message: String(error) });
      return { ok: true } as const;
    });
    if (!limited.ok) {
      throw new McpToolError("rate_limited", "Demasiadas solicitudes seguidas para esta conexión.", {
        retryAfterSeconds: limited.retryAfterSeconds,
        hint: `Espera ${limited.retryAfterSeconds} s antes de volver a intentar.`,
      });
    }

    if (definition.scope === "write" && !connection.canWrite) {
      throw new McpToolError("writes_disabled", "Esta conexión solo puede leer.", {
        hint: "La persona puede volver a conectar Filmia y marcar «Permitir cambios», o crear un token con cambios.",
      });
    }

    const args = z.object(definition.input).strict().parse(rawArgs ?? {});
    const data = await definition.run({ userId: connection.userId, connection, now: deps.now(), deps }, args);
    const checked = z.object(definition.output).safeParse(data);
    if (!checked.success) {
      throw new Error(`output of ${definition.name} does not match its schema: ${checked.error.message}`);
    }
    return ok(checked.data as Record<string, unknown>);
  } catch (error) {
    const body = toErrorBody(error, logError);
    errorCode = body.error.code;
    return fail(body);
  } finally {
    if (connection && deps.recordCall) {
      const call: McpToolCall = {
        connection,
        tool: definition.name,
        ok: errorCode === null,
        errorCode,
        durationMs: Date.now() - started,
      };
      deps.recordCall(call).catch((error) => deps.log("mcp.activity.failed", { message: String(error) }));
    }
  }
};

/** Registers a tool on the SDK server; the name must be unique. */
export const registerTool = (server: McpServer, definition: ToolDefinition, deps: McpToolDeps) => {
  server.registerTool(
    definition.name,
    {
      title: definition.title,
      description: definition.description,
      inputSchema: advertiseOnly(z.object(definition.input).strict()),
      outputSchema: z.object(definition.output),
      annotations: toolAnnotations(definition),
      ...(definition.meta ? { _meta: definition.meta } : {}),
    },
    // The SDK passes the raw arguments (our input schema accepts anything) and the context.
    (async (args: unknown, ctx: ServerContext) => executeTool(definition, deps, connectionFrom(ctx), args)) as never,
  );
};

export const registerTools = (server: McpServer, definitions: ToolDefinition[], deps: McpToolDeps) => {
  const seen = new Set<string>();
  for (const definition of definitions) {
    if (seen.has(definition.name)) throw new Error(`MCP tool registered twice: ${definition.name}`);
    seen.add(definition.name);
    registerTool(server, definition, deps);
  }
};
