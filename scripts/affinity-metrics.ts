import { config as loadEnv } from "dotenv";
import { sql } from "drizzle-orm";

/**
 * FIL-I9-5 · «Para ti» in the wild. READ-ONLY. Takes the first `affinity_shown` per user and
 * film (the level the ficha showed) and what happened next: added to the library, watched,
 * and the rating given. Levels are calibrated when «me gustó» (≥7 or Favoritas) goes
 * alta > media > baja. Recalibrate (eval:affinity) once there are enough rated rows.
 *
 *   npm run metrics:affinity -- --env=<path to .env> [--days=60]
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
  const days = Number(flag("days") ?? 60);
  const { db } = await import("../src/db/index");
  console.log(`Base de datos: ${new URL(process.env.DATABASE_URL).host} (solo lectura)\n`);

  const result = await db.execute(sql`
    with shown as (
      select distinct on (e."userId", e."catalogId")
        e."userId", e."catalogId", e.lens, e."createdAt"
      from "PickEvent" e
      where e.kind = 'affinity_shown'
        and e."createdAt" > now() - make_interval(days => ${days})
      order by e."userId", e."catalogId", e."createdAt"
    )
    select
      split_part(s.lens, ':', 2) as level,
      count(*)::int as shown,
      count(t.id) filter (where t."createdAt" >= s."createdAt")::int as added,
      count(t.id) filter (where t."watchedAt" >= s."createdAt")::int as watched,
      count(t.id) filter (where t."watchedAt" >= s."createdAt" and t.rating is not null)::int as rated,
      count(t.id) filter (
        where t."watchedAt" >= s."createdAt"
          and (t.rating >= 7 or exists (
            select 1 from "ListItem" li join "List" l on l.id = li."listId"
            where li."catalogId" = t."catalogId" and l."userId" = t."userId" and l.slug = 'favoritas'))
      )::int as liked,
      avg(t.rating) filter (where t."watchedAt" >= s."createdAt")::float as mean_rating
    from shown s
    left join "Title" t on t."userId" = s."userId" and t."catalogId" = s."catalogId"
    group by 1
    order by 1`);

  const rows = result.rows as Array<{
    level: string;
    shown: number;
    added: number;
    watched: number;
    rated: number;
    liked: number;
    mean_rating: number | null;
  }>;
  if (rows.length === 0) {
    console.log(`Sin eventos affinity_shown en ${days} días.`);
    process.exit(0);
  }
  const order = ["alta", "alta~", "media", "media~", "baja", "baja~"];
  rows.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
  const pct = (n: number, d: number) => (d === 0 ? "—" : `${((n / d) * 100).toFixed(0)} %`);
  console.log(`Últimos ${days} días, todas las cuentas (anónimo). «~» = poca confianza.\n`);
  console.log("| Nivel | Fichas | Añadidas | Vistas después | Me gustó / vistas | Nota media (1–10) |");
  console.log("|---|---:|---:|---:|---:|---:|");
  for (const row of rows) {
    console.log(
      `| ${row.level} | ${row.shown} | ${row.added} (${pct(row.added, row.shown)}) | ${row.watched} | ${row.liked}/${row.watched} (${pct(row.liked, row.watched)}) | ${row.mean_rating == null ? "—" : row.mean_rating.toFixed(1)} |`,
    );
  }
  const rate = (prefix: string) => {
    const group = rows.filter((row) => row.level.startsWith(prefix));
    const watched = group.reduce((sum, row) => sum + row.watched, 0);
    const liked = group.reduce((sum, row) => sum + row.liked, 0);
    return { watched, rate: watched === 0 ? null : liked / watched };
  };
  const [alta, media, baja] = [rate("alta"), rate("media"), rate("baja")];
  const share = (value: number | null) => (value == null ? "—" : pct(value, 1));
  const enough = alta.watched >= 10 && media.watched >= 10 && baja.watched >= 5;
  console.log(
    `\nOrden «me gustó»: alta ${share(alta.rate)} · media ${share(media.rate)} · baja ${share(baja.rate)} — ${
      enough
        ? (alta.rate ?? 0) >= (media.rate ?? 0) && (media.rate ?? 0) >= (baja.rate ?? 0)
          ? "en orden: los niveles separan."
          : "fuera de orden: revisar cortes con eval:affinity."
        : "aún pocos datos para juzgar (≥10 vistas en alta y media, ≥5 en baja)."
    }`,
  );
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
