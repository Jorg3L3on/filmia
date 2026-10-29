import { config as loadEnv } from "dotenv";
import { sql } from "drizzle-orm";

/**
 * FIL-I11-3 · How many titles an account holds when it finishes the Bienvenida. READ-ONLY.
 * Baseline (2026-10-13): 10 of 18 finished with 0 titles. Since FIL-I11 a first finish needs ≥3,
 * so every account onboarded after the deploy should land in «≥3».
 *
 * Counts titles created up to a minute after `onboardedAt`. Skips accounts backfilled by 0007
 * (onboardedAt = createdAt: they never saw the flow) and `@filmia.local` QA accounts unless
 * --include-qa. --since splits before/after a date (the FIL-I11 deploy).
 *
 *   npm run metrics:onboarding -- --env=<path to .env> [--days=90] [--since=2026-10-14] [--include-qa]
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
  const days = Number(flag("days") ?? 90);
  const sinceRaw = flag("since");
  const since = sinceRaw ? new Date(sinceRaw) : null;
  if (since && Number.isNaN(since.getTime())) {
    throw new Error(`--since no es una fecha: ${sinceRaw}`);
  }
  const includeQa = args.includes("--include-qa");
  if (process.env.FILMIA_LOCAL_PG === "1") {
    const { installLocalPg } = await import("../src/db/local-pg");
    installLocalPg();
  }
  const { db } = await import("../src/db/index");
  console.log(`Base de datos: ${new URL(process.env.DATABASE_URL).host} (solo lectura)\n`);

  const result = await db.execute(sql`
    select
      u."onboardedAt" as "onboardedAt",
      (select count(*)::int from "Title" t
        where t."userId" = u.id and t."createdAt" <= u."onboardedAt" + interval '1 minute') as titles
    from "User" u
    where u."onboardedAt" is not null
      and u."onboardedAt" > u."createdAt"
      and u."onboardedAt" > now() - make_interval(days => ${days})
      and (${includeQa} or u.email not like '%@filmia.local')
    order by u."onboardedAt"`);

  const rows = (result.rows as Array<{ onboardedAt: string | Date; titles: number }>).map((row) => ({
    at: new Date(row.onboardedAt),
    titles: Number(row.titles),
  }));
  if (rows.length === 0) {
    console.log(`Nadie terminó la Bienvenida en ${days} días.`);
    process.exit(0);
  }

  const pct = (n: number, d: number) => (d === 0 ? "—" : `${((n / d) * 100).toFixed(0)} %`);
  const groups = since
    ? [
        { label: `Antes de ${since.toISOString().slice(0, 10)}`, rows: rows.filter((row) => row.at < since) },
        { label: `Desde ${since.toISOString().slice(0, 10)}`, rows: rows.filter((row) => row.at >= since) },
      ]
    : [{ label: `Últimos ${days} días`, rows }];

  console.log(`Títulos al terminar la Bienvenida${includeQa ? " (con cuentas QA)" : ""}.\n`);
  console.log("| Periodo | Cuentas | 0 títulos | 1–2 | ≥3 | % con ≥3 | Mediana |");
  console.log("|---|---:|---:|---:|---:|---:|---:|");
  for (const group of groups) {
    const n = group.rows.length;
    const zero = group.rows.filter((row) => row.titles === 0).length;
    const few = group.rows.filter((row) => row.titles > 0 && row.titles < 3).length;
    const enough = group.rows.filter((row) => row.titles >= 3).length;
    const sorted = group.rows.map((row) => row.titles).sort((a, b) => a - b);
    const median = n === 0 ? "—" : String(sorted[Math.floor((n - 1) / 2)]);
    console.log(`| ${group.label} | ${n} | ${zero} | ${few} | ${enough} | ${pct(enough, n)} | ${median} |`);
  }

  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
