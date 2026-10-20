import pg from "pg";

/**
 * Answers the Neon HTTP protocol from a plain local Postgres, so `drizzle-orm/neon-http`
 * (and every `db.batch`) runs unchanged against a local database in tests and in
 * `npm run dev` with FILMIA_LOCAL_PG=1. Never used in production: `pg` is a devDependency.
 *
 * Request: POST with `Neon-Connection-String` and either `{ query, params }` or
 * `{ queries: [...] }` (a batch, run in one transaction). Response rows are arrays of
 * text values plus `fields[{ name, dataTypeID }]`; the Neon client parses them by type.
 */

type NeonQuery = { query: string; params: unknown[] };

const pools = new Map<string, pg.Pool>();

// Values go back as Postgres text, like Neon's `Neon-Raw-Text-Output`.
const rawText = { getTypeParser: () => (value: string) => value };

const poolFor = (connectionString: string) => {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  const key = url.toString();
  let pool = pools.get(key);
  if (!pool) {
    // Neon runs in UTC; `now()` into a `timestamp` column must match what drizzle writes.
    pool = new pg.Pool({ connectionString: key, max: 10, options: "-c TimeZone=UTC" });
    pools.set(key, pool);
  }
  return pool;
};

const run = async (client: pg.PoolClient | pg.Pool, { query, params }: NeonQuery) => {
  const result = await client.query({
    text: query,
    values: params,
    rowMode: "array",
    types: rawText,
  });
  return {
    command: result.command,
    rowCount: result.rowCount,
    rows: result.rows,
    fields: result.fields.map((field) => ({ name: field.name, dataTypeID: field.dataTypeID })),
  };
};

const errorBody = (error: unknown) => {
  const source = error as Record<string, unknown>;
  const body: Record<string, unknown> = { message: error instanceof Error ? error.message : String(error) };
  for (const key of ["code", "detail", "constraint", "table", "column", "schema", "severity"]) {
    if (source?.[key] !== undefined) body[key] = source[key];
  }
  return body;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const localPgFetch = async (_url: string | URL | Request, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  const connectionString = headers.get("Neon-Connection-String");
  if (!connectionString) return json({ message: "missing Neon-Connection-String" }, 400);
  const pool = poolFor(connectionString);
  const body = JSON.parse(String(init?.body ?? "{}")) as NeonQuery | { queries: NeonQuery[] };

  if (!("queries" in body)) {
    try {
      return json(await run(pool, body));
    } catch (error) {
      return json(errorBody(error), 400);
    }
  }

  const client = await pool.connect();
  try {
    const isolation = headers.get("Neon-Batch-Isolation-Level");
    await client.query(
      isolation ? `BEGIN ISOLATION LEVEL ${isolation.replace(/([a-z])([A-Z])/g, "$1 $2")}` : "BEGIN",
    );
    const results = [];
    for (const query of body.queries) results.push(await run(client, query));
    await client.query("COMMIT");
    return json({ results });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    return json(errorBody(error), 400);
  } finally {
    client.release();
  }
};

export const closeLocalPg = async () => {
  await Promise.all([...pools.values()].map((pool) => pool.end()));
  pools.clear();
};

/** Makes `@/db` answer from the local Postgres (see `createDb`). */
export const installLocalPg = () => {
  (globalThis as { __filmiaLocalPgFetch?: unknown }).__filmiaLocalPgFetch = localPgFetch;
};
