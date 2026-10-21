import { z } from "zod";
import { DomainError } from "@/lib/domain-error";

/**
 * Tool errors the connector may answer (FIL-I20-2). Anything else a tool throws becomes
 * `internal` with a generic message; the real one only goes to the server log, so a
 * database error never reaches the agent.
 */
export const MCP_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "not_found",
  "validation",
  "rate_limited",
  "writes_disabled",
  "confirmation_required",
  "internal",
] as const;

export type McpErrorCode = (typeof MCP_ERROR_CODES)[number];

export type McpErrorCandidate = { id: string; title: string; detail?: string };

export class McpToolError extends Error {
  readonly code: McpErrorCode;
  readonly hint?: string;
  readonly candidates?: McpErrorCandidate[];
  readonly retryAfterSeconds?: number;

  constructor(
    code: McpErrorCode,
    message: string,
    options: { hint?: string; candidates?: McpErrorCandidate[]; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = "McpToolError";
    this.code = code;
    this.hint = options.hint;
    this.candidates = options.candidates;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export const notFound = (what: string, hint?: string) => new McpToolError("not_found", `No encontré ${what}.`, { hint });

const INTERNAL_MESSAGE = "Algo falló de nuestro lado. Inténtalo de nuevo en un momento.";

const describeIssues = (error: z.ZodError) =>
  error.issues
    .slice(0, 5)
    .map((issue) => {
      const path = issue.path.join(".") || "(argumentos)";
      if (issue.code === "unrecognized_keys") return `${path}: campos no admitidos (${issue.keys.join(", ")})`;
      return `${path}: ${issue.message}`;
    })
    .join("; ");

export type McpErrorBody = {
  error: {
    code: McpErrorCode;
    message: string;
    hint?: string;
    candidates?: McpErrorCandidate[];
    retry_after_seconds?: number;
  };
};

/** Allow-list: our own errors and zod validation pass through; the rest is `internal`. */
export const toErrorBody = (error: unknown, log: (error: unknown) => void): McpErrorBody => {
  if (error instanceof McpToolError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        ...(error.hint ? { hint: error.hint } : {}),
        ...(error.candidates ? { candidates: error.candidates } : {}),
        ...(error.retryAfterSeconds ? { retry_after_seconds: error.retryAfterSeconds } : {}),
      },
    };
  }
  if (error instanceof DomainError) {
    return { error: { code: error.code, message: error.message } };
  }
  if (error instanceof z.ZodError) {
    return { error: { code: "validation", message: `Argumentos inválidos: ${describeIssues(error)}` } };
  }
  log(error);
  return { error: { code: "internal", message: INTERNAL_MESSAGE } };
};
