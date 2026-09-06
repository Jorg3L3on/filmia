const POSTGRES_PROTOCOLS = new Set(["postgresql:", "postgres:"]);

const stripSurroundingQuotes = (value: string) => {
  let next = value;

  while (next.length >= 2) {
    const first = next[0];
    const last = next[next.length - 1];
    const quoted =
      (first === '"' && last === '"') || (first === "'" && last === "'");

    if (!quoted) {
      break;
    }

    next = next.slice(1, -1).trim();
  }

  return next;
};

const assertPostgresUrl = (value: string) => {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "DATABASE_URL no es una URL válida. Quita comillas y saltos de línea del secreto.",
    );
  }

  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(
      `DATABASE_URL debe usar el protocolo postgresql: o postgres: (recibido: ${parsed.protocol}).`,
    );
  }
};

export const sanitizeDatabaseUrl = (raw: string | undefined | null) => {
  if (raw == null) {
    throw new Error(
      "DATABASE_URL no está definida. Copia .env.example a .env y configura Neon.",
    );
  }

  const sanitized = stripSurroundingQuotes(raw.replace(/^\uFEFF/, "").trim());

  if (!sanitized) {
    throw new Error("DATABASE_URL está vacía.");
  }

  assertPostgresUrl(sanitized);
  return sanitized;
};

export const resolveDatabaseUrl = () =>
  sanitizeDatabaseUrl(process.env.DATABASE_URL);
