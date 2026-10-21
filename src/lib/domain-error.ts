/**
 * An expected failure of a domain write (not found, not allowed, invalid), shared by the Server
 * Actions (whose UI shows `message`) and the MCP tools (which answer with `code`).
 */
export class DomainError extends Error {
  readonly code: "not_found" | "forbidden" | "validation";

  constructor(code: DomainError["code"], message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export const isDomainError = (error: unknown): error is DomainError => error instanceof DomainError;
