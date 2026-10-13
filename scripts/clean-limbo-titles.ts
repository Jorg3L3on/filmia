import { config as loadEnv } from "dotenv";
import { inArray, sql } from "drizzle-orm";

loadEnv({ path: ".env.local" });
loadEnv();

import { db, titles } from "../src/db/index";

/**
 * FIL-I8-6 · Titles «en limbo»: what Buscar's old FICHA button (and Hoy's
 * recommendation sheet) created just to open a ficha. Nothing personal on
 * them: not watched, no nota, reseña, plataforma or estado de serie, in no
 * list (Quiero ver included), never picked or logged for Hoy. Only the Title
 * goes; the shared Catalog row stays.
 *
 * Dry run by default (counts per user + a sample). `--apply` deletes, and
 * only after Jorge's OK on the dry run, against Neon.
 */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida.");
}

const apply = process.argv.includes("--apply");
/** A Title this young may be mid-action (created, its list insert still in flight). */
const MIN_AGE = "10 minutes";

type LimboRow = { id: string; userId: string; email: string | null; name: string; createdAt: Date };

const findLimbo = async (): Promise<LimboRow[]> => {
  const result = await db.execute(sql`
    select t.id, t."userId", u.email, c.name, t."createdAt"
    from "Title" t
    join "Catalog" c on c.id = t."catalogId"
    left join "User" u on u.id = t."userId"
    where t."watchedAt" is null
      and t.rating is null
      and (t.review is null or btrim(t.review) = '')
      and t.platform is null
      and t."seriesStatus" is null
      and t."createdAt" < now() - ${MIN_AGE}::interval
      and not exists (select 1 from "ListItem" li where li."titleId" = t.id)
      and not exists (select 1 from "TonightPick" tp where tp."titleId" = t.id)
      and not exists (select 1 from "PickEvent" pe where pe."titleId" = t.id)
    order by u.email, t."createdAt"
  `);
  return result.rows as LimboRow[];
};

const run = async () => {
  const rows = await findLimbo();
  const byUser = new Map<string, LimboRow[]>();
  for (const row of rows) {
    const key = row.email ?? row.userId;
    byUser.set(key, [...(byUser.get(key) ?? []), row]);
  }

  console.log(`Titles en limbo: ${rows.length} (${byUser.size} cuentas)`);
  for (const [user, list] of byUser) {
    const sample = list
      .slice(0, 8)
      .map((row) => `${row.name} (${new Date(row.createdAt).toISOString().slice(0, 10)})`)
      .join(", ");
    console.log(`- ${user}: ${list.length} · ${sample}${list.length > 8 ? ", …" : ""}`);
  }

  if (!apply) {
    console.log("\nDry run: nada se borró. Con el OK de Jorge: npm run db:clean-limbo -- --apply");
    return;
  }

  const ids = rows.map((row) => row.id);
  for (let index = 0; index < ids.length; index += 200) {
    await db.delete(titles).where(inArray(titles.id, ids.slice(index, index + 200)));
  }
  console.log(`\nBorrados ${ids.length} Titles en limbo.`);
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
