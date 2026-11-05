import { config as loadEnv } from "dotenv";

/**
 * FIL-I41-1 · Audit accounts for the user audit (walks, design review, security pass).
 *
 *   FILMIA_LOCAL_PG=1 \
 *   DATABASE_URL=postgresql://jorgeleon@localhost:5432/filmia_audit \
 *   DATABASE_URL_UNPOOLED=postgresql://jorgeleon@localhost:5432/filmia_audit \
 *   npm run db:seed:audit
 *
 * Three fictitious accounts (`*.test` addresses, no real people):
 * - Normal: ~40 titles (30 movies, 10 series), 15 watched and rated, 5 reviews, a diary over
 *   September and October 2026, platforms, two own lists (one shared with Pareja), Quiero ver
 *   with a pinned saved view, and «Avísame» on two upcoming premieres in Cine.
 * - Pareja: 15 titles, editor of Normal's shared list, which is their «Qué vemos juntos» room.
 * - Nueva: no titles and Bienvenida pending, for the sign-up / Elige 3 walk.
 *
 * LOCAL ONLY: refuses any non-local host (and says so for neon.tech) before it imports the
 * database module. Idempotent: everything is looked up before it is written, so a second run
 * reports 0 writes. Shared `Catalog` rows are only inserted, never updated.
 */

loadEnv({ path: ".env.local" });
loadEnv();

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const assertLocalDatabase = () => {
  const urls = [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter(
    (value): value is string => Boolean(value),
  );
  if (urls.length === 0) {
    throw new Error("DATABASE_URL no está definida.");
  }
  for (const raw of urls) {
    const host = new URL(raw.replace(/^["']|["']$/g, "")).hostname.toLowerCase();
    if (host.endsWith("neon.tech")) {
      throw new Error(`Rechazado: ${host} es Neon. Este seed solo corre en el Postgres local.`);
    }
    if (!LOCAL_HOSTS.has(host)) {
      throw new Error(`Rechazado: ${host} no es local. Este seed solo corre en el Postgres local.`);
    }
    if (!new URL(raw).username) {
      throw new Error("La URL local necesita el usuario (postgresql://<usuario>@localhost:5432/<base>).");
    }
  }
};

type Platform =
  | "NETFLIX" | "PRIME" | "MAX" | "DISNEY" | "CLARO" | "APPLE" | "MUBI" | "PARAMOUNT"
  | "CRUNCHYROLL" | "VIX" | "PLUTO" | "AMCPLUS" | "CURIOSITY" | "LIONSGATE";
type Kind = "MOVIE" | "SERIES";
type SeriesStatus = "WATCHING" | "FINISHED" | "DROPPED";

type Film = { tmdbId: number; kind: Kind; name: string; originalName?: string; year: number; posterPath: string };

const movie = (tmdbId: number, name: string, year: number, posterPath: string, originalName?: string): Film => ({
  tmdbId, kind: "MOVIE", name, year, posterPath, originalName,
});
const series = (tmdbId: number, name: string, year: number, posterPath: string, originalName?: string): Film => ({
  tmdbId, kind: "SERIES", name, year, posterPath, originalName,
});

// Real TMDB ids (checked against TMDB es-MX on 2026-11-05) so fichas render.
const F = {
  gladiator: movie(98, "Gladiador", 2000, "/p08mUnCktZ2opGihZTAn7OqzOoi.jpg", "Gladiator"),
  darkKnight: movie(155, "Batman: El caballero de la noche", 2008, "/vLFCrzI3V4kbze877tP1H7TqppL.jpg", "The Dark Knight"),
  interstellar: movie(157336, "Interestelar", 2014, "/oBvINgU5r10WHvG6VSopCOlWtJP.jpg", "Interstellar"),
  bladeRunner: movie(335984, "Blade Runner 2049", 2017, "/cOt8SQwrxpoTv9Bc3kyce3etkZX.jpg"),
  dune2: movie(693134, "Duna: Parte dos", 2024, "/6o5cJjA4srfvU52UKWaqPUuPPgl.jpg", "Dune: Part Two"),
  parasite: movie(496243, "Parásitos", 2019, "/j4AOjNlhvudYDijiT0lxeHAsPkk.jpg", "기생충"),
  budapest: movie(120467, "El Gran Hotel Budapest", 2014, "/1wk0vpNCX5T40KsGQKjfoDAhmJw.jpg", "The Grand Budapest Hotel"),
  madMax: movie(76341, "Mad Max: Furia en el camino", 2015, "/ixSuKuBnSfHmyzZbcWCywOKZ6Ho.jpg", "Mad Max: Fury Road"),
  johnWick: movie(245891, "Otro día para matar", 2014, "/mHJX5D5FKKoC0GWUAWFq2qJZrPv.jpg", "John Wick"),
  superbad: movie(8363, "Supercool", 2007, "/hx6sr6iMpqy2uxs7Gl6Kdq7jwLH.jpg", "Superbad"),
  northman: movie(639933, "El Hombre del Norte", 2022, "/x7qa0IaNE9BoXVUjk0x0i58ch1H.jpg", "The Northman"),
  inception: movie(27205, "El Origen", 2010, "/xgPGDEKkBrXhPaNmwIlf8e2RCMk.jpg", "Inception"),
  pulpFiction: movie(680, "Tiempos Violentos", 1994, "/sjb1KYPp57GhG96Sc6WJDddP3f7.jpg", "Pulp Fiction"),
  fightClub: movie(550, "El club de la pelea", 1999, "/bI0BhpswEApC0B17RhLZtRVPZiQ.jpg", "Fight Club"),
  matrix: movie(603, "Matrix", 1999, "/8rT9kG2EYkZpJmYCuTJNnPDEube.jpg", "The Matrix"),
  chihiro: movie(129, "El viaje de Chihiro", 2001, "/4TfZdXABpM0j0FIyRSUQDUXxVwV.jpg", "千と千尋の神隠し"),
  oppenheimer: movie(872585, "Oppenheimer", 2023, "/mJRUREPjTqqMEKwEiM2sdmIGngz.jpg"),
  barbie: movie(346698, "Barbie", 2023, "/lF3ViyfgJ8VEwQSlqPhuhm6WW43.jpg"),
  everything: movie(545611, "Todo en todas partes al mismo tiempo", 2022, "/vbR5YirdyIQyLzWHALmdDAJshWC.jpg", "Everything Everywhere All at Once"),
  prestige: movie(1124, "El Gran Truco", 2006, "/6NHAZLR4AJhBAVU4qFzkucfyhVl.jpg", "The Prestige"),
  silence: movie(274, "El Silencio de los Inocentes", 1991, "/jrzX7TCmoD5gedFeqb1iB9sBaSn.jpg", "The Silence of the Lambs"),
  goodfellas: movie(769, "Buenos Muchachos", 1990, "/nocvbyxKR5b1vxagy46SfEiMK3P.jpg", "GoodFellas"),
  godfather: movie(238, "El Padrino", 1972, "/ApiEfzSkrqS4m1L5a2GwWXzIiAs.jpg", "The Godfather"),
  departed: movie(1422, "Los Infiltrados", 2006, "/x8bBjXbVS7V7r5g2PPCUpkHuL7M.jpg", "The Departed"),
  truman: movie(37165, "Truman Show: Historia de una Vida", 1998, "/az3nrwaVQ2fmDh4sstY1vejuo4M.jpg", "The Truman Show"),
  getOut: movie(419430, "¡Huye!", 2017, "/s0BriSYHEOIypAM0ZhUIQUOr3HE.jpg", "Get Out"),
  poorThings: movie(792307, "Pobres Criaturas", 2023, "/xbfzQ7Q7qmDUf50eZH8C57Ygx6n.jpg", "Poor Things"),
  anatomy: movie(915935, "Anatomía de una Caída", 2023, "/31MkIlfEaQ5vopz5lulP96xbZyU.jpg", "Anatomie d'une chute"),
  yTuMama: movie(1391, "Y tu mamá también", 2001, "/oLl2f0r3c6WMhXv6hYOyjQj4LGU.jpg"),
  fauno: movie(1417, "El laberinto del fauno", 2006, "/cxVlgYbn1GAdVhuBjM2jFiavfRp.jpg"),
  roma: movie(426426, "Roma", 2018, "/veWGVw33lnifG10fpkz3QmimVaI.jpg"),
  amoresPerros: movie(55, "Amores perros", 2000, "/uoObXx53SjSLLtAavMSIe02zizs.jpg"),
  laLaLand: movie(313369, "La La Land: Una historia de amor", 2016, "/2aBAqu6f0fBpr47gDI6Fje56sCn.jpg", "La La Land"),
  amelie: movie(194, "Amélie", 2001, "/mYvUib00miJWxWkiXhy3QnrCj96.jpg", "Le Fabuleux Destin d'Amélie Poulain"),
  pride: movie(4348, "Orgullo y Prejuicio", 2005, "/oixzLjpyaLagLa8UREts1NiHr6F.jpg", "Pride & Prejudice"),
  tangled: movie(38757, "Enredados", 2010, "/z5kvXWek4smCyeWBDJQkT5sLc9T.jpg", "Tangled"),
  up: movie(14160, "Up: Una Aventura de Altura", 2009, "/vSdpOU6rDK7IpmOD7iAvlZdMUCc.jpg", "Up"),
  wallE: movie(10681, "WALL·E", 2008, "/m3gKwcubqhN8J7pLcMcCDY1YJLJ.jpg"),
  breakingBad: series(1396, "Breaking Bad", 2008, "/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg"),
  lastOfUs: series(100088, "The Last of Us", 2023, "/tNQWO6cNzQYCyvw36mUcAQQyf5F.jpg"),
  severance: series(95396, "Severance", 2022, "/1sylo2yeVyJ8KMZgcZLSopR66DA.jpg"),
  thrones: series(1399, "Juego De Tronos", 2011, "/6eEYfJtcJQ6e6J2lzkgzUDShR6V.jpg", "Game of Thrones"),
  stranger: series(66732, "Stranger Things", 2016, "/AsPD90QEQsIAtSxfSjV3fN7XFpt.jpg"),
  bear: series(136315, "El Oso", 2022, "/5TZnk9ryzfcNlsCOghURfZsBong.jpg", "The Bear"),
  saul: series(60059, "Better Call Saul", 2015, "/fC2HDm5t0kHl7mTm7jxMR31b7by.jpg"),
  succession: series(76331, "Succession", 2018, "/xyHasySw0HQ4ndRWHvrpRTAsWXd.jpg"),
  chernobyl: series(87108, "Chernobyl", 2019, "/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg"),
  dragon: series(94997, "La casa del dragón", 2022, "/szyVpg9K3LL5s8VFAGkXzlxgZUk.jpg", "House of the Dragon"),
  dark: series(70523, "Dark", 2017, "/gw8ZlIXEg6SIx3FgMEQqmBkPYKV.jpg"),
  shogun: series(126308, "Shōgun", 2024, "/uIoDvVOQaKjSfz2oihkVS8M7l1v.jpg"),
} satisfies Record<string, Film>;

/** Upcoming MX premieres (TMDB release type 3, as of 2026-11-05) for Cine «Avísame». */
const PREMIERES: Array<{ film: Film; mxReleaseDate: string; popularity: number }> = [
  { film: movie(1400336, "La nueva Focker", 2026, "/iU2XxFhMxC5Z2gOPASkRmtuDjJQ.jpg"), mxReleaseDate: "2026-11-26", popularity: 10 },
  { film: movie(1110034, "Kraken: Terror en lo profundo", 2026, "/r0GXlZdBXakqBg9lNoLiMeW5AUc.jpg"), mxReleaseDate: "2026-12-31", popularity: 51 },
];

/** A personal entry. `day` is a 2026 date `MM-DD`: the diary entry. */
type Entry = {
  film: Film;
  day?: string;
  rating?: number;
  review?: string;
  platform?: Platform;
  seriesStatus?: SeriesStatus;
  seriesSeason?: number;
};

type Account = {
  id: string;
  email: string;
  password: string;
  name: string;
  onboarded: boolean;
  platforms: Platform[];
  entries: Entry[];
  /** Quiero ver, in order, with an optional queue note. */
  queue: Array<{ film: Film; note?: string }>;
};

// Test passwords live here only (never in Plania, PRs or chat). Local DB only.
const NORMAL: Account = {
  id: "cmaudit0normal0000000001",
  email: "normal@auditoria.test",
  password: "auditoria-normal-2026",
  name: "Normal Auditoría",
  onboarded: true,
  platforms: ["NETFLIX", "PRIME", "MAX", "DISNEY"],
  entries: [
    // Watched and rated: 15 (11 movies, 4 series), diary across September and October 2026.
    { film: F.dune2, day: "09-03", rating: 9, platform: "MAX", review: "Enorme en todo: sonido, escala y ritmo. La segunda mitad es puro vértigo." },
    { film: F.parasite, day: "09-07", rating: 10, platform: "PRIME", review: "Cambia de género tres veces y nunca se cae. La escalera dice todo." },
    { film: F.madMax, day: "09-12", rating: 8, platform: "MAX" },
    { film: F.budapest, day: "09-14", rating: 8, platform: "DISNEY" },
    { film: F.johnWick, day: "09-20", rating: 7, platform: "PRIME" },
    { film: F.inception, day: "09-26", rating: 9, platform: "MAX" },
    { film: F.getOut, day: "09-28", rating: 8, platform: "NETFLIX", review: "Incómoda de la mejor manera. La segunda vez se ven todas las pistas." },
    { film: F.oppenheimer, day: "10-04", rating: 8, platform: "PRIME" },
    { film: F.everything, day: "10-10", rating: 9, platform: "PRIME" },
    { film: F.anatomy, day: "10-17", rating: 7, platform: "MAX", review: "El juicio está bien, pero lo mejor es la casa y el perro." },
    { film: F.roma, day: "10-24", rating: 9, platform: "NETFLIX" },
    { film: F.breakingBad, day: "09-18", rating: 10, platform: "NETFLIX", seriesStatus: "FINISHED", seriesSeason: 5 },
    { film: F.severance, day: "10-08", rating: 9, platform: "APPLE", seriesStatus: "WATCHING", seriesSeason: 2, review: "Rara, fría y adictiva. Me falta terminar la segunda temporada." },
    { film: F.bear, day: "10-21", rating: 8, platform: "DISNEY", seriesStatus: "WATCHING", seriesSeason: 3 },
    { film: F.chernobyl, day: "10-29", rating: 9, platform: "MAX", seriesStatus: "FINISHED", seriesSeason: 1 },
    // Started, not rated yet.
    { film: F.lastOfUs, platform: "MAX", seriesStatus: "WATCHING", seriesSeason: 1 },
    { film: F.thrones, platform: "MAX", seriesStatus: "DROPPED", seriesSeason: 6 },
    // Saved, only in a list.
    { film: F.yTuMama },
    { film: F.fauno },
    { film: F.amoresPerros },
  ],
  queue: [
    { film: F.bladeRunner, note: "Para una noche con buena pantalla" },
    { film: F.interstellar },
    { film: F.poorThings, note: "Me la recomendaron mucho" },
    { film: F.northman },
    { film: F.departed },
    { film: F.godfather, note: "Pendiente de toda la vida" },
    { film: F.goodfellas },
    { film: F.pulpFiction },
    { film: F.fightClub },
    { film: F.matrix },
    { film: F.chihiro },
    { film: F.prestige },
    { film: F.silence },
    { film: F.superbad, note: "Para reír sin pensar" },
    { film: F.truman },
    { film: F.gladiator },
    { film: F.laLaLand },
    { film: F.barbie },
    { film: F.stranger },
    { film: F.saul },
    { film: F.succession },
    { film: F.dark },
    { film: F.dragon },
  ],
};

const PAREJA: Account = {
  id: "cmaudit0pareja0000000001",
  email: "pareja@auditoria.test",
  password: "auditoria-pareja-2026",
  name: "Pareja Auditoría",
  onboarded: true,
  platforms: ["NETFLIX", "DISNEY", "APPLE"],
  // 12 rated (≥ AFFINITY_MIN_RATED, so «Qué vemos juntos» ranks), 8 of them seen with Normal on the same night.
  entries: [
    { film: F.dune2, day: "09-03", rating: 7, platform: "MAX" },
    { film: F.parasite, day: "09-07", rating: 9, platform: "PRIME" },
    { film: F.budapest, day: "09-14", rating: 10, platform: "DISNEY" },
    { film: F.inception, day: "09-26", rating: 7, platform: "MAX" },
    { film: F.getOut, day: "09-28", rating: 6, platform: "NETFLIX" },
    { film: F.laLaLand, day: "10-02", rating: 9, platform: "NETFLIX" },
    { film: F.amelie, day: "10-06", rating: 10, platform: "MUBI", review: "Mi película de domingo. Siempre funciona." },
    { film: F.everything, day: "10-10", rating: 8, platform: "PRIME" },
    { film: F.pride, day: "10-11", rating: 8, platform: "PRIME" },
    { film: F.up, day: "10-13", rating: 9, platform: "DISNEY" },
    { film: F.bear, day: "10-21", rating: 9, platform: "DISNEY", seriesStatus: "WATCHING", seriesSeason: 3 },
    { film: F.roma, day: "10-24", rating: 8, platform: "NETFLIX" },
    { film: F.stranger, platform: "NETFLIX", seriesStatus: "WATCHING", seriesSeason: 4 },
  ],
  queue: [
    { film: F.tangled },
    { film: F.wallE },
    { film: F.chihiro, note: "Con palomitas" },
  ],
};

const NUEVA: Account = {
  id: "cmaudit0nueva00000000001",
  email: "nueva@auditoria.test",
  password: "auditoria-nueva-2026",
  name: "Nueva Auditoría",
  onboarded: false,
  platforms: [],
  entries: [],
  queue: [],
};

/** Not created: for walking «Crear cuenta» from scratch. */
const REGISTRO_EMAIL = "registro@auditoria.test";

/** Normal's own lists. The first is shared with Pareja as editor: their «Qué vemos juntos». */
const NORMAL_LISTS: Array<{
  id: string;
  name: string;
  description: string;
  items: Array<{ film: Film; addedBy: "normal" | "pareja" }>;
  editor?: Account;
}> = [
  {
    id: "cmaudit0lista0pareja0001",
    name: "Para ver en pareja",
    description: "Lo que vemos juntos los viernes.",
    editor: PAREJA,
    items: [
      { film: F.interstellar, addedBy: "normal" },
      { film: F.laLaLand, addedBy: "pareja" },
      { film: F.chihiro, addedBy: "pareja" },
      { film: F.truman, addedBy: "normal" },
      { film: F.barbie, addedBy: "pareja" },
      { film: F.poorThings, addedBy: "normal" },
      { film: F.stranger, addedBy: "normal" },
      { film: F.budapest, addedBy: "pareja" },
    ],
  },
  {
    id: "cmaudit0lista0mexico0001",
    name: "Cine mexicano",
    description: "Las que siempre recomiendo.",
    items: [
      { film: F.yTuMama, addedBy: "normal" },
      { film: F.fauno, addedBy: "normal" },
      { film: F.roma, addedBy: "normal" },
      { film: F.amoresPerros, addedBy: "normal" },
    ],
  },
];

/** Normal's Favoritas (fixed list). */
const NORMAL_FAVORITAS = [F.parasite, F.breakingBad, F.dune2];

/** Normal's pinned saved view in Quiero ver. */
const NORMAL_VIEW = { id: "cmaudit0vista0series0001", name: "Solo series", query: "kind=SERIES" };

/** The app's convention for a diary day: noon UTC of that civil date (`isoDateToUtcNoon`). */
const watchedAt = (day: string) => new Date(`2026-${day}T12:00:00.000Z`);

const main = async () => {
  assertLocalDatabase();
  const { installLocalPg, closeLocalPg } = await import("../src/db/local-pg");
  installLocalPg();

  const { and, count, eq, inArray } = await import("drizzle-orm");
  const { createId } = await import("@paralleldrive/cuid2");
  const {
    catalog, cinemaReleases, db, listItems, listMembers, lists, pickEvents, savedViews, titles, users,
  } = await import("../src/db/index");
  const { hashPassword, verifyPassword } = await import("../src/lib/auth/password");
  const { findOrCreateCatalog } = await import("../src/lib/catalog");
  const { DEFAULT_LISTS, FAVORITAS_SLUG, WATCHLIST_SLUG } = await import("../src/lib/lists");
  const { normalizeViewQuery } = await import("../src/lib/watchlist-views");

  const writes = new Map<string, number>();
  const wrote = (what: string) => writes.set(what, (writes.get(what) ?? 0) + 1);

  const catalogIds = new Map<string, string>();
  const catalogFor = async (film: Film) => {
    const key = `${film.kind}:${film.tmdbId}`;
    const known = catalogIds.get(key);
    if (known) return known;
    const { row, created } = await findOrCreateCatalog(film);
    if (created) wrote("Catalog");
    catalogIds.set(key, row.id);
    return row.id;
  };

  const sameSet = (current: unknown, wanted: string[]) =>
    Array.isArray(current) && current.length === wanted.length && wanted.every((value) => current.includes(value));

  const ensureUser = async (account: Account) => {
    const existing = await db.query.users.findFirst({ where: eq(users.id, account.id) });
    if (!existing) {
      const clash = await db.query.users.findFirst({ where: eq(users.email, account.email), columns: { id: true } });
      if (clash) throw new Error(`${account.email} ya existe con otro id; bórrala a mano en la base local.`);
      await db.insert(users).values({
        id: account.id,
        email: account.email,
        name: account.name,
        passwordHash: await hashPassword(account.password),
        streamingPlatforms: account.platforms,
        onboardedAt: account.onboarded ? new Date("2026-09-01T12:00:00-06:00") : null,
        createdAt: new Date("2026-09-01T12:00:00-06:00"),
      });
      wrote("User");
      return;
    }
    const set: Partial<typeof users.$inferInsert> = {};
    if (existing.email !== account.email) set.email = account.email;
    if (existing.name !== account.name) set.name = account.name;
    if (!existing.passwordHash || !(await verifyPassword(account.password, existing.passwordHash))) {
      set.passwordHash = await hashPassword(account.password);
    }
    if (!sameSet(existing.streamingPlatforms, account.platforms)) set.streamingPlatforms = account.platforms;
    // Nueva's Bienvenida is left as the walk leaves it: a re-run never resets an onboarding in progress.
    if (account.onboarded && !existing.onboardedAt) set.onboardedAt = new Date("2026-09-01T12:00:00-06:00");
    if (Object.keys(set).length > 0) {
      await db.update(users).set(set).where(eq(users.id, account.id));
      wrote("User");
    }
  };

  const ensureDefaultLists = async (userId: string) => {
    const rows = await db.select().from(lists).where(eq(lists.userId, userId));
    for (const list of DEFAULT_LISTS) {
      if (rows.some((row) => row.slug === list.slug)) continue;
      const now = new Date();
      await db.insert(lists).values({
        id: createId(),
        userId,
        slug: list.slug,
        name: list.name,
        description: list.description,
        kind: list.kind,
        createdAt: now,
        updatedAt: now,
      });
      wrote("List");
    }
    const bySlug = async (slug: string) => {
      const row = await db.query.lists.findFirst({ where: and(eq(lists.userId, userId), eq(lists.slug, slug)) });
      if (!row) throw new Error(`No se pudo crear la lista ${slug}.`);
      return row.id;
    };
    return { watchlistId: await bySlug(WATCHLIST_SLUG), favoritasId: await bySlug(FAVORITAS_SLUG) };
  };

  const ensureTitle = async (userId: string, entry: Entry) => {
    const catalogId = await catalogFor(entry.film);
    const wanted = {
      rating: entry.rating ?? null,
      review: entry.review ?? null,
      platform: entry.platform ?? null,
      watchedAt: entry.day ? watchedAt(entry.day) : null,
      seriesStatus: entry.film.kind === "SERIES" ? (entry.seriesStatus ?? null) : null,
      seriesSeason: entry.film.kind === "SERIES" ? (entry.seriesSeason ?? null) : null,
    };
    const existing = await db.query.titles.findFirst({
      where: and(eq(titles.userId, userId), eq(titles.catalogId, catalogId)),
    });
    if (!existing) {
      const createdAt = wanted.watchedAt ?? new Date("2026-09-01T12:00:00-06:00");
      // `Title.updatedAt` has no DB default (Prisma-era column): always set both stamps.
      await db.insert(titles).values({ id: createId(), userId, catalogId, ...wanted, createdAt, updatedAt: createdAt });
      wrote("Title");
      return catalogId;
    }
    const changed =
      existing.rating !== wanted.rating ||
      existing.review !== wanted.review ||
      existing.platform !== wanted.platform ||
      (existing.watchedAt?.getTime() ?? null) !== (wanted.watchedAt?.getTime() ?? null) ||
      existing.seriesStatus !== wanted.seriesStatus ||
      existing.seriesSeason !== wanted.seriesSeason;
    if (changed) {
      await db.update(titles).set(wanted).where(eq(titles.id, existing.id));
      wrote("Title");
    }
    return catalogId;
  };

  const ensureItem = async (
    listId: string,
    catalogId: string,
    position: number,
    addedByUserId: string,
    queueNote: string | null = null,
  ) => {
    const existing = await db.query.listItems.findFirst({
      where: and(eq(listItems.listId, listId), eq(listItems.catalogId, catalogId)),
    });
    if (!existing) {
      await db.insert(listItems).values({
        listId,
        catalogId,
        position,
        addedByUserId,
        queueNote,
        addedAt: new Date(Date.UTC(2026, 8, 1) + position * 3_600_000),
      });
      wrote("ListItem");
      return;
    }
    if (existing.position !== position || existing.queueNote !== queueNote || existing.addedByUserId !== addedByUserId) {
      await db
        .update(listItems)
        .set({ position, queueNote, addedByUserId })
        .where(and(eq(listItems.listId, listId), eq(listItems.catalogId, catalogId)));
      wrote("ListItem");
    }
  };

  const seedAccount = async (account: Account) => {
    await ensureUser(account);
    if (!account.onboarded) return null;
    const ids = await ensureDefaultLists(account.id);
    for (const entry of account.entries) await ensureTitle(account.id, entry);
    for (const [position, item] of account.queue.entries()) {
      const catalogId = await ensureTitle(account.id, { film: item.film });
      await ensureItem(ids.watchlistId, catalogId, position, account.id, item.note ?? null);
    }
    return ids;
  };

  // 1 · Accounts, titles, Quiero ver.
  const normalLists = await seedAccount(NORMAL);
  await seedAccount(PAREJA);
  await seedAccount(NUEVA);
  if (!normalLists) throw new Error("Normal no tiene listas.");

  // 2 · Normal's Favoritas and own lists; the shared one gets Pareja as editor.
  for (const [position, film] of NORMAL_FAVORITAS.entries()) {
    await ensureItem(normalLists.favoritasId, await catalogFor(film), position, NORMAL.id);
  }
  for (const list of NORMAL_LISTS) {
    const existing = await db.query.lists.findFirst({ where: eq(lists.id, list.id) });
    if (!existing) {
      const now = new Date("2026-09-05T12:00:00-06:00");
      await db.insert(lists).values({
        id: list.id,
        userId: NORMAL.id,
        name: list.name,
        description: list.description,
        kind: "COLLECTION",
        createdAt: now,
        updatedAt: now,
      });
      wrote("List");
    } else if (existing.userId !== NORMAL.id) {
      throw new Error(`La lista ${list.id} no es de Normal.`);
    } else if (existing.name !== list.name || existing.description !== list.description) {
      await db.update(lists).set({ name: list.name, description: list.description }).where(eq(lists.id, list.id));
      wrote("List");
    }
    for (const [position, item] of list.items.entries()) {
      await ensureItem(list.id, await catalogFor(item.film), position, item.addedBy === "pareja" ? PAREJA.id : NORMAL.id);
    }
    if (list.editor) {
      const member = await db.query.listMembers.findFirst({
        where: and(eq(listMembers.listId, list.id), eq(listMembers.userId, list.editor.id)),
      });
      if (!member) {
        await db.insert(listMembers).values({
          listId: list.id,
          userId: list.editor.id,
          role: "EDITOR",
          joinedAt: new Date("2026-09-06T12:00:00-06:00"),
        });
        wrote("ListMember");
      } else if (member.role !== "EDITOR") {
        await db
          .update(listMembers)
          .set({ role: "EDITOR" })
          .where(and(eq(listMembers.listId, list.id), eq(listMembers.userId, list.editor.id)));
        wrote("ListMember");
      }
    }
  }

  // 3 · Quiero ver · the pinned saved view.
  const viewQuery = normalizeViewQuery(NORMAL_VIEW.query);
  if (viewQuery === "") throw new Error("La vista guardada no tiene filtros.");
  const view = await db.query.savedViews.findFirst({ where: eq(savedViews.id, NORMAL_VIEW.id) });
  if (!view) {
    const now = new Date("2026-10-01T12:00:00-06:00");
    await db.update(savedViews).set({ pinned: false }).where(and(eq(savedViews.userId, NORMAL.id), eq(savedViews.pinned, true)));
    await db.insert(savedViews).values({
      id: NORMAL_VIEW.id, userId: NORMAL.id, name: NORMAL_VIEW.name, query: viewQuery, pinned: true, createdAt: now, updatedAt: now,
    });
    wrote("SavedView");
  } else if (view.userId !== NORMAL.id) {
    throw new Error(`La vista ${NORMAL_VIEW.id} no es de Normal.`);
  }

  // 4 · Cine · two upcoming premieres with «Avísame».
  for (const premiere of PREMIERES) {
    const catalogId = await catalogFor(premiere.film);
    const inserted = await db
      .insert(cinemaReleases)
      .values({ catalogId, mxReleaseDate: premiere.mxReleaseDate, status: "upcoming", popularity: premiere.popularity, source: "tmdb" })
      .onConflictDoNothing()
      .returning({ catalogId: cinemaReleases.catalogId });
    if (inserted.length > 0) wrote("CinemaRelease");
    const reminder = await db.query.pickEvents.findFirst({
      where: and(eq(pickEvents.userId, NORMAL.id), eq(pickEvents.kind, "cine_avisame"), eq(pickEvents.catalogId, catalogId)),
      columns: { id: true },
    });
    if (!reminder) {
      await db.insert(pickEvents).values({
        id: createId(), userId: NORMAL.id, titleId: null, catalogId, kind: "cine_avisame", lens: "cine",
        createdAt: new Date("2026-11-01T12:00:00-06:00"),
      });
      wrote("PickEvent");
    }
  }

  // 5 · Counts and logins.
  const accounts = [NORMAL, PAREJA, NUEVA];
  const ids = accounts.map((account) => account.id);
  const titleCounts = new Map(
    (await db.select({ userId: titles.userId, n: count() }).from(titles).where(inArray(titles.userId, ids)).groupBy(titles.userId)).map(
      (row) => [row.userId, row.n],
    ),
  );
  const listCounts = new Map(
    (await db.select({ userId: lists.userId, n: count() }).from(lists).where(inArray(lists.userId, ids)).groupBy(lists.userId)).map(
      (row) => [row.userId, row.n],
    ),
  );
  const watchedCounts = new Map(
    (
      await db
        .select({ userId: titles.userId, n: count(titles.watchedAt), rated: count(titles.rating), reviews: count(titles.review) })
        .from(titles)
        .where(inArray(titles.userId, ids))
        .groupBy(titles.userId)
    ).map((row) => [row.userId, row]),
  );
  const kinds = new Map(
    (
      await db
        .select({ userId: titles.userId, kind: catalog.kind, n: count() })
        .from(titles)
        .innerJoin(catalog, eq(catalog.id, titles.catalogId))
        .where(inArray(titles.userId, ids))
        .groupBy(titles.userId, catalog.kind)
    ).map((row) => [`${row.userId}:${row.kind}`, row.n]),
  );
  const [shared] = await db.select({ n: count() }).from(listMembers).where(eq(listMembers.userId, PAREJA.id));
  const [reminders] = await db
    .select({ n: count() })
    .from(pickEvents)
    .where(and(eq(pickEvents.userId, NORMAL.id), eq(pickEvents.kind, "cine_avisame")));
  const [views] = await db.select({ n: count() }).from(savedViews).where(eq(savedViews.userId, NORMAL.id));

  console.log(`Base: ${new URL(process.env.DATABASE_URL!).pathname.slice(1)} (local)`);
  console.log(
    writes.size === 0
      ? "Nada que cambiar: 0 escrituras."
      : `Escrituras: ${[...writes.values()].reduce((a, b) => a + b, 0)} (${[...writes].map(([what, n]) => `${what} ${n}`).join(", ")}).`,
  );
  for (const account of accounts) {
    const watched = watchedCounts.get(account.id);
    console.log(
      `${account.name.padEnd(17)} ${account.email.padEnd(24)} títulos ${titleCounts.get(account.id) ?? 0}` +
        ` (pelis ${kinds.get(`${account.id}:MOVIE`) ?? 0}, series ${kinds.get(`${account.id}:SERIES`) ?? 0})` +
        ` · vistos ${watched?.n ?? 0} · calificados ${watched?.rated ?? 0} · reseñas ${watched?.reviews ?? 0}` +
        ` · listas ${listCounts.get(account.id) ?? 0}`,
    );
  }
  console.log(`Normal: vistas guardadas ${views.n} · avisos de Cine ${reminders.n}. Pareja: miembro de ${shared.n} lista compartida (Qué vemos juntos).`);
  // Emails only: the passwords stay in this file, out of logs and evidence.
  console.log(`Entradas: ${accounts.map((account) => account.email).join(", ")} (contraseñas en scripts/seed-audit.ts).`);
  console.log(`Registro desde cero: usa ${REGISTRO_EMAIL} (no se crea).`);

  await closeLocalPg();
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
