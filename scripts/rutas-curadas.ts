import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";

/**
 * FIL-I26-5 · Rutas curadas: writes `data/rutas-curadas.json` as curated lists of one account
 * (`List.curated`, the order, and each film's «why» in its note). Idempotent: a ruta is matched
 * by its slug (`curada-<slug>`) and rewritten; films are looked up in TMDB by title and year.
 * WRITES to whatever DATABASE_URL points at: against Neon only with Jorge's OK.
 *
 *   npx tsx scripts/rutas-curadas.ts --email=<owner> [--env=<path>] [--dry-run]
 *   (local: FILMIA_LOCAL_PG=1 DATABASE_URL=postgresql://<user>@localhost:5432/<db>)
 */

const args = process.argv.slice(2);
const flag = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const envPath = flag("env");
if (envPath) {
  loadEnv({ path: envPath });
}
loadEnv({ path: ".env.local" });
loadEnv();

type FilmRef = { title: string; year: number; why?: string; tmdbId?: number };
type CuratedSpec = {
  slug: string;
  title: string;
  description?: string;
  desde?: string;
  hasta?: string;
  after?: FilmRef[];
  films: FilmRef[];
};

const main = async () => {
  const email = flag("email")?.toLowerCase();
  if (!email) {
    throw new Error("Falta --email=<cuenta dueña de las rutas curadas>.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida.");
  }
  const dryRun = args.includes("--dry-run");
  if (process.env.FILMIA_LOCAL_PG === "1") {
    const { installLocalPg } = await import("../src/db/local-pg");
    installLocalPg();
  }
  const { and, eq } = await import("drizzle-orm");
  const { createId } = await import("@paralleldrive/cuid2");
  const { db, users, lists, listItems } = await import("../src/db/index");
  const { searchTmdb, isTmdbConfigured } = await import("../src/lib/tmdb");
  const { findOrCreateCatalog } = await import("../src/lib/catalog");
  const { enrichCatalog } = await import("../src/lib/catalog-enrich");
  if (!isTmdbConfigured()) {
    throw new Error("Falta TMDB_API_KEY.");
  }
  console.log(`Base de datos: ${new URL(process.env.DATABASE_URL).host}${dryRun ? " (simulación)" : ""}\n`);

  const owner = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
  if (!owner) {
    throw new Error(`No hay cuenta ${email}.`);
  }
  const spec = JSON.parse(readFileSync("data/rutas-curadas.json", "utf8")) as { rutas: CuratedSpec[] };

  const resolve = async (ref: FilmRef) => {
    const results = await searchTmdb(ref.title, "MOVIE", ref.year);
    // A pinned id wins (search sometimes ranks a special or a short first).
    const hit = ref.tmdbId
      ? (results.find((item) => item.tmdbId === ref.tmdbId) ??
        { tmdbId: ref.tmdbId, name: ref.title, originalName: null, year: ref.year, posterPath: null })
      : (results.find((item) => item.year === ref.year) ?? results[0]);
    if (!hit) {
      console.log(`  ✗ sin resultado en TMDB: ${ref.title} (${ref.year})`);
    }
    return hit ?? null;
  };

  for (const ruta of spec.rutas) {
    const films: Array<{ catalogId: string; name: string; why: string | null }> = [];
    for (const ref of ruta.films) {
      const hit = await resolve(ref);
      if (!hit) continue;
      if (dryRun) {
        films.push({ catalogId: String(hit.tmdbId), name: hit.name, why: ref.why ?? null });
        continue;
      }
      const { row, created } = await findOrCreateCatalog({
        tmdbId: hit.tmdbId,
        kind: "MOVIE",
        name: hit.name,
        originalName: hit.originalName,
        year: hit.year,
        posterPath: hit.posterPath,
      });
      if (created || !row.runtimeMinutes) {
        await enrichCatalog(row).catch(() => false);
      }
      films.push({ catalogId: row.id, name: row.name, why: ref.why ?? null });
    }
    const after = (await Promise.all((ruta.after ?? []).map((ref) => resolve(ref)))).flatMap((hit) => (hit ? [hit.tmdbId] : []));
    console.log(`• ${ruta.title}${ruta.hasta ? ` (hasta ${ruta.hasta})` : ""}: ${films.map((film) => film.name).join(" → ")}`);
    if (dryRun) continue;

    const slug = `curada-${ruta.slug}`;
    const existing = await db.query.lists.findFirst({
      where: and(eq(lists.userId, owner.id), eq(lists.slug, slug)),
      columns: { id: true },
    });
    const listId = existing?.id ?? createId();
    const values = {
      name: ruta.title,
      description: ruta.description ?? null,
      curated: true,
      curatedFrom: ruta.desde ?? null,
      curatedUntil: ruta.hasta ?? null,
      curatedFor: after,
    };
    if (existing) {
      await db.update(lists).set(values).where(eq(lists.id, listId));
      await db.delete(listItems).where(eq(listItems.listId, listId));
    } else {
      await db.insert(lists).values({ id: listId, userId: owner.id, kind: "COLLECTION", slug, ...values });
    }
    if (films.length > 0) {
      await db.insert(listItems).values(
        films.map((film, position) => ({
          listId,
          catalogId: film.catalogId,
          addedByUserId: owner.id,
          position,
          queueNote: film.why,
        })),
      );
    }
  }
  console.log(`\n${spec.rutas.length} rutas curadas ${dryRun ? "revisadas" : "guardadas"}.`);
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
