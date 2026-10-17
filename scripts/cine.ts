import { config as loadEnv } from "dotenv";

/**
 * FIL-I17 · Cine from the console.
 *
 *   npm run cine:revisar                 # read-only: the stored cartelera (now / upcoming / gone)
 *   npm run cine:revisar -- --status=now # one status
 *   npm run cine:correr                  # WRITES: runs the cron steps (TMDB → Catalog + CinemaRelease)
 *
 * Both take --env=<path to .env>.
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

const pad = (value: string, width: number) => (value.length > width ? `${value.slice(0, width - 1)}…` : value.padEnd(width));

const revisar = async () => {
  const { asc, desc, eq } = await import("drizzle-orm");
  const { catalog, cinemaReleases, db } = await import("../src/db/index");
  const status = flag("status");
  const rows = await db
    .select({
      name: catalog.name,
      tmdbId: catalog.tmdbId,
      mxReleaseDate: cinemaReleases.mxReleaseDate,
      status: cinemaReleases.status,
      popularity: cinemaReleases.popularity,
      source: cinemaReleases.source,
      lastSeenAt: cinemaReleases.lastSeenAt,
    })
    .from(cinemaReleases)
    .innerJoin(catalog, eq(catalog.id, cinemaReleases.catalogId))
    .where(status ? eq(cinemaReleases.status, status) : undefined)
    .orderBy(asc(cinemaReleases.status), desc(cinemaReleases.mxReleaseDate));

  let current = "";
  for (const row of rows) {
    if (row.status !== current) {
      current = row.status;
      console.log(`\n── ${current} (${rows.filter((r) => r.status === current).length})`);
    }
    console.log(
      `${row.mxReleaseDate}  ${row.popularity.toFixed(1).padStart(6)}  ${pad(row.source, 6)}  ${pad(row.name, 48)}  tmdb ${row.tmdbId}`,
    );
  }
  console.log(`\n${rows.length} filas.`);
};

const correr = async () => {
  const { refreshCinemaReleases } = await import("../src/lib/cine-store");
  const started = Date.now();
  console.log(JSON.stringify({ cartelera: await refreshCinemaReleases() }, null, 2));
  console.log(`${Math.round((Date.now() - started) / 1000)} s`);
};

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida (usa --env=<ruta al .env>).");
  }
  if (command === "correr") {
    await correr();
  } else {
    await revisar();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
