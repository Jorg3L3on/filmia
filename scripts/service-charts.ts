import { config as loadEnv } from "dotenv";

/**
 * FIL-I47 · Hoy's ranking per service from the console.
 *
 *   npm run charts:revisar                    # read-only: rows stored per platform and kind
 *   npm run charts:correr                     # WRITES: runs the cron step (TMDB discover → Catalog + ServiceChart)
 *   npm run charts:correr -- --plataformas=NETFLIX,MAX
 *
 * All take --env=<path to .env>. With FILMIA_LOCAL_PG=1 they talk to the local Postgres in DATABASE_URL.
 */

const args = process.argv.slice(2);
const flag = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const command = args.find((arg) => !arg.startsWith("--")) ?? "revisar";

const envPath = flag("env");
if (envPath) {
  loadEnv({ path: envPath });
}
loadEnv({ path: ".env.local" });
loadEnv();

const revisar = async () => {
  const { asc, count } = await import("drizzle-orm");
  const { db, serviceCharts } = await import("../src/db/index");
  const rows = await db
    .select({ platform: serviceCharts.platform, kind: serviceCharts.kind, source: serviceCharts.source, period: serviceCharts.period, rows: count() })
    .from(serviceCharts)
    .groupBy(serviceCharts.platform, serviceCharts.kind, serviceCharts.source, serviceCharts.period)
    .orderBy(asc(serviceCharts.platform), asc(serviceCharts.kind));
  for (const row of rows) {
    console.log(`${row.platform.padEnd(12)} ${row.kind.padEnd(7)} ${row.source.padEnd(11)} ${row.period}  ${row.rows}`);
  }
  console.log(`${rows.length} listas`);
};

const correr = async () => {
  const { PLATFORMS } = await import("../src/lib/labels");
  const { refreshServiceCharts } = await import("../src/lib/service-charts-store");
  const only = flag("plataformas")?.split(",").filter((value) => (PLATFORMS as string[]).includes(value));
  const summary = await refreshServiceCharts(only?.length ? { platforms: only as typeof PLATFORMS } : {});
  console.log(JSON.stringify(summary, null, 2));
};

const main = async () => {
  if (process.env.FILMIA_LOCAL_PG === "1") {
    const { installLocalPg } = await import("../src/db/local-pg");
    installLocalPg();
  }
  if (command === "correr") {
    await correr();
  } else {
    await revisar();
  }
};

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
