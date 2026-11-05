import { DrizzleQueryError } from "drizzle-orm/errors";

/** A failure that came from the database driver (SQL text, params, constraint names). */
export const isDatabaseError = (error: unknown): boolean => {
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 5; depth += 1) {
    if (current instanceof DrizzleQueryError || current.message.startsWith("Failed query")) {
      return true;
    }
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
      return true;
    }
    current = current.cause;
  }
  return false;
};

/**
 * The message an action may hand back to the client (FIL-I41-8): our own validation copy,
 * never a database error. Those are logged on the server and the client gets `fallback`.
 */
export const publicErrorMessage = (caught: unknown, fallback: string): string => {
  if (caught instanceof Error && !isDatabaseError(caught)) {
    return caught.message;
  }
  console.error("[action] unexpected failure", caught);
  return fallback;
};
