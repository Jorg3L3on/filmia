import { config as loadEnv } from "dotenv";

/**
 * FIL-I60-2 · fill every Para ti pool on a LOCAL database with the same code the cron runs,
 * repeating runs until each antojo × kind is fresh (or a run makes no progress). Refuses a
 * hosted database: production is filled by the daily cron only.
 *
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> npm run para-ti:llenar -- --env=<path to .env>
 *
 * `--env` only supplies TMDB_API_KEY (and friends): a DATABASE_URL already set wins. No OMDb calls.
 */

const args = process.argv.slice(2);
const flag = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const envPath = flag("env");
if (envPath) {
  loadEnv({ path: envPath, quiet: true });
}
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const main = async () => {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL no está definida.");
  }
  const host = new URL(url).hostname;
  if (host.endsWith("neon.tech") || !LOCAL_HOSTS.has(host)) {
    throw new Error(`Solo para una base local (recibí ${host}). Producción la llena el cron diario.`);
  }
  process.env.FILMIA_LOCAL_PG = "1";
  const { installLocalPg, closeLocalPg } = await import("../src/db/local-pg");
  installLocalPg();
  const { runParaTiRefresh, paraTiPoolCounts } = await import("../src/lib/para-ti/pool-store");

  const total = { runs: 0, rowsWritten: 0, newCatalogRows: 0, tmdbCalls: 0 };
  const started = Date.now();
  for (let run = 1; run <= 20; run += 1) {
    const summary = await runParaTiRefresh({ startBudgetMs: 600_000 });
    total.runs += 1;
    total.rowsWritten += summary.rowsWritten;
    total.newCatalogRows += summary.newCatalogRows;
    total.tmdbCalls += summary.tmdbCalls;
    console.log(
      `Corrida ${run}: ${summary.refreshed} reservas · ${summary.newCatalogRows} fichas nuevas · ${summary.tmdbCalls} llamadas TMDB · ${summary.skippedFresh} frescas · ${summary.deferred} pendientes · ${summary.failed} fallidas`,
    );
    if (summary.refreshed === 0 || summary.skippedFresh + summary.refreshed === summary.pools) {
      break;
    }
  }

  console.log(`\nTotal: ${JSON.stringify(total)} · ${((Date.now() - started) / 1000).toFixed(0)} s\n`);
  for (const row of await paraTiPoolCounts()) {
    console.log(`${row.antojo.padEnd(11)} ${row.kind.padEnd(7)} ${row.rows}`);
  }
  await closeLocalPg();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
