/**
 * Development only: mints a personal MCP token for a user of the LOCAL database, to try the
 * connector with curl or the MCP Inspector. Refuses anything but a localhost DATABASE_URL.
 *   FILMIA_LOCAL_PG=1 DATABASE_URL=postgresql://localhost:5432/filmia_dev npx tsx scripts/mcp-dev-token.ts demo@filmia.local [--write]
 */
import { eq } from "drizzle-orm";
import { installLocalPg, closeLocalPg } from "../src/db/local-pg";
import { db, users } from "../src/db";
import { createPersonalToken } from "../src/lib/mcp-oauth/service";
import { postgresOAuthStore } from "../src/lib/mcp-oauth/store-postgres";

const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || process.env.FILMIA_LOCAL_PG !== "1") {
  throw new Error("Solo con FILMIA_LOCAL_PG=1 y un DATABASE_URL local.");
}
installLocalPg();

const main = async () => {
  const email = process.argv[2];
  if (!email) throw new Error("Uso: mcp-dev-token.ts <correo> [--write]");
  const user = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
  if (!user) throw new Error(`No existe ${email} en la base local.`);
  const created = await createPersonalToken(
    { store: postgresOAuthStore, now: () => new Date() },
    { userId: user.id, name: "Token de desarrollo", days: 7, allowWrite: process.argv.includes("--write") },
  );
  console.log(created.token);
  await closeLocalPg();
};

void main();
