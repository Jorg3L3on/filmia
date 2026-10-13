import { config as loadEnv } from "dotenv";
import { eq } from "drizzle-orm";

/**
 * FIL-I9-3 · preview of one user's «Para ti» levels and what the scorer costs. READ-ONLY.
 * Builds the scorer like Buscar does (cold, `--runs` times), then shows the level and the
 * reasons for a sample of Catalog films the user has not watched.
 *
 *   npm run preview:affinity -- --env=<path to .env> --email=<a@b> [--runs=5] [--sample=12]
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
  const email = flag("email")?.toLowerCase();
  if (!email) {
    throw new Error("Falta --email=<cuenta>.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida (usa --env=<ruta al .env>).");
  }
  const runs = Number(flag("runs") ?? 5);
  const sample = Number(flag("sample") ?? 12);
  const { db, users, catalog } = await import("../src/db/index");
  const { loadTonightInput } = await import("../src/lib/tonight-store");
  const { buildAffinityScorer } = await import("../src/lib/tonight/affinity");
  const { affinityForCatalogRow, loadAffinityLibrary } = await import("../src/lib/affinity-store");
  const { quantile } = await import("../src/lib/tonight/affinity");

  const user = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
  if (!user) {
    throw new Error(`No existe la cuenta ${email}.`);
  }
  console.log(`Base de datos: ${new URL(process.env.DATABASE_URL).host} (solo lectura)`);

  const loadMs: number[] = [];
  const buildMs: number[] = [];
  let built: ReturnType<typeof buildAffinityScorer> = null;
  let input: Awaited<ReturnType<typeof loadTonightInput>> | null = null;
  for (let run = 0; run < runs; run += 1) {
    const t0 = performance.now();
    input = await loadTonightInput(user.id);
    const t1 = performance.now();
    built = buildAffinityScorer(input.titles, input.events, input.now);
    const t2 = performance.now();
    loadMs.push(t1 - t0);
    buildMs.push(t2 - t1);
  }
  const fmt = (values: number[]) =>
    `p50 ${quantile(values, 0.5).toFixed(0)} ms · p95 ${quantile(values, 0.95).toFixed(0)} ms`;
  const slimMs: number[] = [];
  for (let run = 0; run < runs; run += 1) {
    const t0 = performance.now();
    const slim = await loadAffinityLibrary(user.id, new Date());
    slimMs.push(performance.now() - t0);
    if (run === 0) {
      const slimScorer = buildAffinityScorer(slim.library, slim.events, new Date());
      console.log(`Cortes con la carga ligera: ${slimScorer?.cutoffs.high.toFixed(3)} / ${slimScorer?.cutoffs.low.toFixed(3)} (deben coincidir)`);
    }
  }
  const rtt: number[] = [];
  for (let run = 0; run < runs; run += 1) {
    const t0 = performance.now();
    await db.execute("select 1");
    rtt.push(performance.now() - t0);
  }
  console.log(`Ida y vuelta a Neon (select 1): ${fmt(rtt)}`);
  console.log(`Carga de Hoy (loadTonightInput, ${input!.titles.length} títulos): ${fmt(loadMs)}`);
  console.log(`Carga ligera de afinidad (affinity_profile_ms sin caché): ${fmt(slimMs)}`);
  console.log(`Perfil + cortes (puro): ${fmt(buildMs)}`);
  if (!built) {
    console.log("Sin perfil (menos de 8 vistas calificadas): Buscar no muestra nada.");
    process.exit(0);
  }
  console.log(
    `Cortes: Muy tu estilo ≥ ${built.cutoffs.high.toFixed(3)} · Fuera de tu zona < ${built.cutoffs.low.toFixed(3)} · ${built.ctx.profile.ratedCount} calificadas`,
  );

  const owned = new Map(
    input!.rows.map((row) => [`${row.kind}:${row.tmdbId}`, { watched: row.watchedAt != null, rating: row.rating }]),
  );
  const rows = await db
    .select({
      id: catalog.id,
      tmdbId: catalog.tmdbId,
      kind: catalog.kind,
      name: catalog.name,
      year: catalog.year,
      imdbRating: catalog.imdbRating,
      imdbVotes: catalog.imdbVotes,
      tmdbGenres: catalog.tmdbGenres,
      tmdbKeywords: catalog.tmdbKeywords,
      tmdbPeople: catalog.tmdbPeople,
      originalLanguage: catalog.originalLanguage,
    })
    .from(catalog);
  const unseen = rows.filter((row) => !owned.get(`${row.kind}:${row.tmdbId}`)?.watched);
  const userAffinity = { scorer: built, ratedCount: built.ctx.profile.ratedCount, owned };
  const counts = { alta: 0, media: 0, baja: 0, none: 0 };
  const examples: string[] = [];
  unseen.forEach((row, index) => {
    const view = affinityForCatalogRow(userAffinity, row);
    if (!view) {
      counts.none += 1;
      return;
    }
    counts[view.level] += 1;
    if (index % Math.max(1, Math.floor(unseen.length / sample)) === 0 && examples.length < sample) {
      examples.push(
        `- ${row.name} (${row.year ?? "?"}) → ${view.label}${view.lowConfidence ? " ~" : ""}\n    ${view.reasons.map((r) => r.text + (r.detail ? ` (${r.detail})` : "")).join(" · ") || "sin razones"}`,
      );
    }
  });
  console.log(`\nNo vistas en el Catalog: ${unseen.length} · Muy tu estilo ${counts.alta} · Podría gustarte ${counts.media} · Fuera de tu zona ${counts.baja} · sin datos ${counts.none}`);
  console.log(examples.join("\n"));
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
