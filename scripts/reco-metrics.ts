import { config as loadEnv } from "dotenv";
import { sql } from "drizzle-orm";

/**
 * FIL-I6-5 · how recommended cards perform against the ones from Quiero ver. READ-ONLY.
 * An event on a recommendation is one filed by film with no title yet (`titleId` IS NULL);
 * once the user adds the film its events carry the title and count as queue.
 *
 *   npm run metrics:recos -- --env=<path to .env> [--days=14]
 */

const args = process.argv.slice(2);
const flag = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const envPath = flag("env");
if (envPath) {
  loadEnv({ path: envPath });
}
loadEnv({ path: ".env.local" });
loadEnv();

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida (usa --env=<ruta al .env>).");
  }
  const days = Number(flag("days") ?? 14);
  const { db } = await import("../src/db/index");

  const result = await db.execute(sql`
    select
      case when "titleId" is null then 'reco' else 'queue' end as source,
      count(*) filter (where kind = 'shown')::int as shown,
      count(*) filter (where kind = 'opened')::int as opened,
      count(*) filter (where kind = 'watched')::int as watched,
      count(*) filter (where kind = 'less_like')::int as less_like,
      count(*) filter (where kind = 'not_tonight')::int as not_tonight
    from "PickEvent"
    where "createdAt" > now() - make_interval(days => ${days})
    group by 1
    order by 1`);
  const rows = result.rows as Array<Record<string, number | string>>;

  // Recommended films the user went on to add (a title created after they first saw the card).
  const adds = await db.execute(sql`
    select count(distinct (e."userId", e."catalogId"))::int as added
    from "PickEvent" e
    join "Title" t on t."userId" = e."userId" and t."catalogId" = e."catalogId"
    where e."titleId" is null
      and e."createdAt" > now() - make_interval(days => ${days})
      and t."createdAt" >= e."createdAt"`);
  const shownFilms = await db.execute(sql`
    select count(distinct (e."userId", e."catalogId"))::int as films
    from "PickEvent" e
    where e."titleId" is null and e.kind = 'shown'
      and e."createdAt" > now() - make_interval(days => ${days})`);

  const added = Number((adds.rows[0] as { added: number }).added);
  const films = Number((shownFilms.rows[0] as { films: number }).films);
  console.log(`Últimos ${days} días (anónimo, todas las cuentas)\n`);
  for (const row of rows) {
    const shown = Number(row.shown);
    const opened = Number(row.opened);
    console.log(
      `${row.source}: vistas en el mazo ${shown} · abiertas ${opened} (${shown ? ((opened / shown) * 100).toFixed(1) : "0.0"} %) · marcadas vistas ${row.watched} · menos así ${row.less_like} · ahora no ${row.not_tonight}`,
    );
  }
  if (!rows.some((row) => row.source === "reco")) {
    console.log("reco: sin eventos todavía");
  }
  console.log(`reco añadidas a la biblioteca: ${added} de ${films} películas mostradas (${films ? ((added / films) * 100).toFixed(1) : "0.0"} %)`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
