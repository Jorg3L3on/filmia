import { config as loadEnv } from "dotenv";
import { and, eq } from "drizzle-orm";

/**
 * FIL-I26 · test accounts for rutas on a LOCAL database. Refuses any non-local database.
 *
 * - `ivan` («caso Ivan»): what Jorge's friend gave on day one (favorita La comunidad del anillo,
 *   liked Michael and Project Hail Mary; Netflix, HBO Max, Prime, Disney+).
 * - `parasitos`: a favorita with no TMDB collection (Parásitos), for «Si te gustó…».
 *
 * `--bienvenida` leaves the account on the Bienvenida's payoff (not onboarded), so the last step
 * («Tu primera ruta») can be tried; the email gets a `+bienvenida` suffix.
 *
 *   FILMIA_LOCAL_PG=1 DATABASE_URL=postgresql://jorgeleon@localhost:5432/filmia_fil_i20_local \
 *     npx tsx scripts/seed-casos-rutas.ts --caso=ivan [--bienvenida] [--reset]
 *
 * Test login: <caso>[+bienvenida]@filmia.local / filmia-<caso>
 */

loadEnv({ path: ".env.local" });
loadEnv();

type Film = { tmdbId: number; name: string; year: number; rating: number; favorite: boolean };

const CASOS: Record<string, { name: string; films: Film[] }> = {
  ivan: {
    name: "Ivan",
    films: [
      { tmdbId: 120, name: "El señor de los anillos: La comunidad del anillo", year: 2001, rating: 10, favorite: true },
      { tmdbId: 936075, name: "Michael", year: 2026, rating: 8, favorite: false },
      { tmdbId: 687163, name: "Proyecto Fin del Mundo", year: 2026, rating: 8, favorite: false },
    ],
  },
  parasitos: {
    name: "Pari",
    films: [
      { tmdbId: 496243, name: "Parásitos", year: 2019, rating: 10, favorite: true },
      { tmdbId: 244786, name: "Whiplash", year: 2014, rating: 8, favorite: false },
      { tmdbId: 313369, name: "La La Land", year: 2016, rating: 7, favorite: false },
    ],
  },
};

const flag = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const main = async () => {
  const caso = flag("caso") ?? "ivan";
  const spec = CASOS[caso];
  if (!spec) {
    throw new Error(`Caso desconocido: ${caso} (${Object.keys(CASOS).join(", ")}).`);
  }
  const bienvenida = process.argv.includes("--bienvenida");
  const IVAN_EMAIL = `${caso}${bienvenida ? "+bienvenida" : ""}@filmia.local`;
  const IVAN_PASSWORD = `filmia-${caso}`;
  const IVAN_ID = `cm4${caso}${bienvenida ? "bv" : ""}filmia`.padEnd(24, "0").slice(0, 24);
  const FILMS = spec.films;
  const url = process.env.DATABASE_URL ?? "";
  const host = url ? new URL(url).hostname : "";
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(`Solo contra una base local (DATABASE_URL apunta a «${host || "nada"}»).`);
  }
  process.env.FILMIA_LOCAL_PG = "1";
  const { installLocalPg, closeLocalPg } = await import("../src/db/local-pg");
  installLocalPg();
  const { db, users, titles, lists, listItems } = await import("../src/db/index");
  const { hashPassword } = await import("../src/lib/auth/password");
  const { ensureDefaultLists, FAVORITAS_SLUG } = await import("../src/lib/lists");
  const { upsertTitleFromTmdbForUser } = await import("../src/lib/add-title-from-tmdb");
  const { enrichCatalog } = await import("../src/lib/catalog-enrich");
  const { findOrCreateCatalog } = await import("../src/lib/catalog");

  if (process.argv.includes("--reset")) {
    await db.delete(users).where(eq(users.id, IVAN_ID));
  }
  const existing = await db.query.users.findFirst({ where: eq(users.email, IVAN_EMAIL) });
  if (!existing) {
    await db.insert(users).values({
      id: IVAN_ID,
      email: IVAN_EMAIL,
      name: spec.name,
      passwordHash: await hashPassword(IVAN_PASSWORD),
      streamingPlatforms: ["NETFLIX", "MAX", "PRIME", "DISNEY"],
      nightEndsAt: { weekday: "23:30", weekend: "01:00" },
      onboardedAt: bienvenida ? null : new Date(),
      onboardingStep: bienvenida ? "primera-noche" : null,
    });
  }
  await ensureDefaultLists(IVAN_ID);
  const favoritas = await db.query.lists.findFirst({
    where: and(eq(lists.userId, IVAN_ID), eq(lists.slug, FAVORITAS_SLUG)),
  });

  for (const film of FILMS) {
    // The catalog row first (enriched here): a new row would schedule its enrichment after a
    // response, which a script does not have.
    const shared = await findOrCreateCatalog({ tmdbId: film.tmdbId, kind: "MOVIE", name: film.name, year: film.year });
    if (!shared.row.runtimeMinutes) {
      await enrichCatalog(shared.row);
    }
    const result = await upsertTitleFromTmdbForUser(IVAN_ID, {
      tmdbId: film.tmdbId,
      kind: "MOVIE",
      name: film.name,
      year: film.year,
      destination: "watched",
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
    await db.update(titles).set({ rating: film.rating }).where(eq(titles.id, result.titleId));
    const row = await db.query.titles.findFirst({ where: eq(titles.id, result.titleId), with: { catalog: true } });
    if (film.favorite && favoritas && row) {
      await db
        .insert(listItems)
        .values({ listId: favoritas.id, catalogId: row.catalogId, addedByUserId: IVAN_ID, position: 0 })
        .onConflictDoNothing();
    }
    console.log(`✓ ${film.name}`);
  }
  console.log(`Listo: ${IVAN_EMAIL} / ${IVAN_PASSWORD}`);
  await closeLocalPg();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
