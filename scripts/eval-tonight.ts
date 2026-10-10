import { config as loadEnv } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { inArray } from "drizzle-orm";

/**
 * FIL-I6-1 · offline evaluation of the recommendation pipeline. READ-ONLY: it never
 * writes to the database. For every user with enough rated watches it hides their most
 * recent well-rated ones, builds candidates from TMDB sources, ranks them with the Esta
 * noche engine and measures how many hidden titles come back (recall@10 / @30).
 *
 *   npm run eval:tonight -- [--env=<path>] [--email=<a@b>] [--limit=<n>] [--out=<file.md>]
 *                           [--max-scored=400] [--folds=3] [--no-providers] [--cache=<file.json>]
 */

const args = process.argv.slice(2);
const flag = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const has = (name: string) => args.includes(`--${name}`);

const envPath = flag("env");
if (envPath) {
  loadEnv({ path: envPath });
}
loadEnv({ path: ".env.local" });
loadEnv();

const MAX_SCORED = Number(flag("max-scored") ?? 400);
const SEED_QUEUE_CAP = 12;
const SEED_ANCHOR_CAP = 6;
/** Diagnostic pool: every liked watch as a seed (upper bound for «more anchors»). */
const SEED_WIDE_CAP = 40;
const FOLDS = Number(flag("folds") ?? 3);
/** How candidates are cut down to MAX_SCORED before the expensive details call. */
const PREFILTER = flag("prefilter") ?? "genre";
const GENRE_POOLS = 3;
const MIN_VOTES = 200;
const QUEUE_WEIGHT = 0.5;
const CONCURRENCY = 6;
const CACHE_FILE = flag("cache") ?? "node_modules/.cache/eval-tonight.json";
const WITH_PROVIDERS = !has("no-providers");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida (usa --env=<ruta al .env>).");
}

const main = async () => {
  const { db, catalog } = await import("../src/db/index");
  const { loadTonightInput, parseStoredKeywords, parseStoredPeople } = await import(
    "../src/lib/tonight-store"
  );
  const { parseStoredTmdbGenres } = await import("../src/lib/diary-picks");
  const { discoverTmdb, getTmdbDetails, getTmdbRelated, isTmdbConfigured } = await import(
    "../src/lib/tmdb"
  );
  const { fetchMxWatchProviders } = await import("../src/lib/watch-providers");
  const { titleAvailableOnUserPlatforms, userStreamingProviderIds } = await import(
    "../src/lib/streaming-platforms"
  );
  const { runPool } = await import("../src/lib/run-pool");
  const { addScaled, clamp01, cosine, itemVector } = await import("../src/lib/tonight/features");
  const { buildTasteProfile } = await import("../src/lib/tonight/profile");
  const { meanImdb, scoreCandidate } = await import("../src/lib/tonight/score");
  const { GUSTO_SCALE } = await import("../src/lib/tonight");
  const { evalKey, hitsAtK, librarySignature, pct, poolHits, splitFolds } = await import(
    "../src/lib/tonight/eval"
  );
  type TonightTitle = import("../src/lib/tonight/types").TonightTitle;
  type TasteProfile = import("../src/lib/tonight/profile").TasteProfile;
  type TitleKind = import("../src/db").TitleKind;
  type Platform = import("../src/db").Platform;
  type Related = Awaited<ReturnType<typeof getTmdbRelated>>[number];

  if (!isTmdbConfigured()) {
    throw new Error("TMDB_API_KEY no está configurada.");
  }
  console.log(`Base de datos: ${new URL(process.env.DATABASE_URL!).host} (solo lectura)`);

  // Disk cache so reruns do not repeat TMDB calls. Values are plain JSON.
  const cache: Record<string, unknown> = existsSync(CACHE_FILE)
    ? JSON.parse(readFileSync(CACHE_FILE, "utf8"))
    : {};
  let calls = 0;
  const cached = async <T>(key: string, load: () => Promise<T>): Promise<T> => {
    if (key in cache) {
      return cache[key] as T;
    }
    calls += 1;
    const value = await load();
    cache[key] = value;
    return value;
  };
  const saveCache = () => {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  };

  const withQueue = (profile: TasteProfile, queueTitles: readonly TonightTitle[]): TasteProfile => {
    const vector = new Map(profile.vector);
    const genreAffinity = new Map(profile.genreAffinity);
    for (const title of queueTitles) {
      addScaled(vector, itemVector(title), QUEUE_WEIGHT);
      for (const genre of title.genres) {
        genreAffinity.set(genre.id, (genreAffinity.get(genre.id) ?? 0) + QUEUE_WEIGHT);
      }
    }
    return { ...profile, vector, genreAffinity, size: profile.size + queueTitles.length };
  };

  const emailFilter = flag("email")?.toLowerCase();
  const limit = Number(flag("limit") ?? 0);
  let userRows = await db.query.users.findMany({ columns: { id: true, email: true } });
  if (emailFilter) {
    userRows = userRows.filter((row) => row.email.toLowerCase() === emailFilter);
  }

  const POOLS = ["recommendations", "recommendations_wide", "similar", "discover", "discover_mx", "union_narrow", "union_prod", "union_all"] as const;
  type Counts = Record<string, number>;
  type UserResult = { user: string; folds: number; counts: Counts; calls: number };
  const results: UserResult[] = [];
  const seenLibraries = new Map<string, string>();
  const now = new Date();

  for (const userRow of userRows) {
    if (limit > 0 && results.length >= limit) {
      break;
    }
    const input = await loadTonightInput(userRow.id, now);
    const folds = splitFolds(input.titles, FOLDS);
    if (folds.length === 0) {
      console.log(`— ${userRow.email}: pocas vistas con nota, se omite`);
      continue;
    }
    const keyOf = (id: string, rowMap: Map<string, (typeof input.rows)[number]>) => {
      const row = rowMap.get(id);
      return row ? evalKey(row.kind, row.tmdbId) : null;
    };
    const rowById = new Map(input.rows.map((row) => [row.id, row]));
    const signature = librarySignature(input.rows.map((row) => evalKey(row.kind, row.tmdbId)));
    const twin = seenLibraries.get(signature);
    if (twin) {
      console.log(`— ${userRow.email}: misma biblioteca que ${twin} (cuenta clonada), se omite`);
      continue;
    }
    seenLibraries.set(signature, userRow.email);

    const callsBefore = calls;
    const counts: Counts = { hidden: 0, queue: 0, seeds: 0, catalog_new: 0, available: 0, available_n: 0 };
    const add = (key: string, value: number) => {
      counts[key] = (counts[key] ?? 0) + value;
    };

    for (const split of folds) {
      const hidden = new Set(split.holdout.map((title) => keyOf(title.id, rowById)!));
      const library = new Set(split.train.map((title) => keyOf(title.id, rowById)!));
      const trainIds = new Set(split.train.map((title) => title.id));
      const trainById = new Map(split.train.map((title) => [title.id, title]));

      const baseProfile = buildTasteProfile(split.train, input.events, now);
      const queueTitles = input.queue
        .filter((entry) => trainIds.has(entry.titleId))
        .sort((a, b) => a.position - b.position)
        .flatMap((entry) => {
          const title = trainById.get(entry.titleId);
          return title && title.watchedAt == null ? [title] : [];
        });
      const profileQueue = withQueue(baseProfile, queueTitles);

      const seedsFrom = (ids: string[]) =>
        [...new Set(ids)].flatMap((id) => {
          const row = rowById.get(id);
          return row ? [{ tmdbId: row.tmdbId, kind: row.kind as TitleKind }] : [];
        });
      const queueSeedIds = queueTitles.slice(0, SEED_QUEUE_CAP).map((title) => title.id);
      const seeds = seedsFrom([
        ...queueSeedIds,
        ...baseProfile.anchors.slice(0, SEED_ANCHOR_CAP).map((anchor) => anchor.titleId),
      ]);
      const wideSeeds = seedsFrom([
        ...queueSeedIds,
        ...split.train
          .filter((title) => title.watchedAt != null && (title.rating ?? 0) >= 7)
          .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.watchedAt?.getTime() ?? 0) - (a.watchedAt?.getTime() ?? 0))
          .slice(0, SEED_WIDE_CAP)
          .map((title) => title.id),
      ]);

      const kinds = new Set<TitleKind>(["MOVIE"]);
      if (split.train.filter((title) => title.kind === "SERIES").length >= 3) {
        kinds.add("SERIES");
      }
      const topGenres = [...profileQueue.genreAffinity.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, GENRE_POOLS)
        .map(([id]) => id);
      const providerIds = userStreamingProviderIds(input.userPlatforms as Platform[]);

      const pools = new Map<string, Map<string, Related>>();
      const addTo = (pool: string, items: Related[]) => {
        const bucket = pools.get(pool) ?? new Map<string, Related>();
        for (const item of items) {
          const key = evalKey(item.kind, item.tmdbId);
          if (!library.has(key) && !bucket.has(key)) {
            bucket.set(key, item);
          }
        }
        pools.set(pool, bucket);
      };
      const related = async (seed: { tmdbId: number; kind: TitleKind }, relation: "recommendations" | "similar") =>
        cached(`v2:${relation}:${seed.kind}:${seed.tmdbId}`, () =>
          getTmdbRelated(seed.tmdbId, seed.kind, relation).catch(() => [] as Related[]),
        );

      const jobs: Array<() => Promise<void>> = [];
      for (const seed of seeds) {
        for (const relation of ["recommendations", "similar"] as const) {
          jobs.push(async () => addTo(relation, await related(seed, relation)));
        }
      }
      for (const seed of wideSeeds) {
        jobs.push(async () => addTo("recommendations_wide", await related(seed, "recommendations")));
      }
      for (const kind of kinds) {
        for (const genreId of topGenres) {
          jobs.push(async () => {
            const plain = await cached(`v2:discover:${kind}:${genreId}`, () =>
              discoverTmdb({ kind, withGenres: [genreId], voteCountGte: MIN_VOTES }).catch(() => [] as Related[]),
            );
            addTo("discover", plain);
          });
          if (providerIds.length > 0) {
            jobs.push(async () => {
              const mx = await cached(`v2:discover-mx:${kind}:${genreId}:${providerIds.join("|")}`, () =>
                discoverTmdb({
                  kind,
                  withGenres: [genreId],
                  voteCountGte: MIN_VOTES,
                  withWatchProviders: providerIds,
                  watchRegion: "MX",
                }).catch(() => [] as Related[]),
              );
              addTo("discover_mx", mx);
            });
          }
        }
      }
      await runPool(jobs, CONCURRENCY, (job) => job());

      for (const name of ["recommendations", "recommendations_wide", "similar", "discover", "discover_mx"]) {
        pools.set(name, pools.get(name) ?? new Map());
      }
      const union = (names: string[]) => {
        const merged = new Map<string, Related>();
        for (const name of names) {
          for (const [key, item] of pools.get(name)!) {
            merged.set(key, item);
          }
        }
        return merged;
      };
      // narrow = queue + 6 anchors as seeds; prod = what we would ship (many liked watches as seeds).
      pools.set("union_narrow", union(["recommendations", "discover_mx"]));
      pools.set("union_prod", union(["recommendations_wide", "discover_mx"]));
      pools.set("union_all", union(["recommendations", "recommendations_wide", "similar", "discover", "discover_mx"]));

      // Candidates reached by several sources come first when the scoring cap bites.
      const hits = new Map<string, number>();
      for (const name of ["recommendations", "recommendations_wide", "similar", "discover", "discover_mx"]) {
        for (const key of pools.get(name)!.keys()) {
          hits.set(key, (hits.get(key) ?? 0) + 1);
        }
      }
      // Cheap taste from the list payload: mean genre affinity (0–1 of the user's best genre),
      // a bonus per source that proposed it, and the TMDB average as a quality nudge.
      const bestAffinity = Math.max(1e-6, ...profileQueue.genreAffinity.values());
      const cheapScore = (key: string, item: Related) => {
        const genres = item.genreIds.map((id) => (profileQueue.genreAffinity.get(id) ?? 0) / bestAffinity);
        const taste = genres.length > 0 ? genres.reduce((a, b) => a + b, 0) / genres.length : 0;
        return taste + 0.2 * (hits.get(key) ?? 0) + 0.03 * (item.voteAverage ?? 6);
      };
      const toScore = [...pools.get("union_all")!.entries()]
        .filter(([, item]) => item.voteCount >= 100)
        .sort((a, b) =>
          PREFILTER === "hits"
            ? (hits.get(b[0]) ?? 0) - (hits.get(a[0]) ?? 0) || b[1].voteCount - a[1].voteCount
            : cheapScore(b[0], b[1]) - cheapScore(a[0], a[1]),
        )
        .slice(0, MAX_SCORED);

      const tmdbIds = [...new Set(toScore.map(([, item]) => item.tmdbId))];
      const catalogRows = tmdbIds.length
        ? await db.query.catalog.findMany({ where: inArray(catalog.tmdbId, tmdbIds) })
        : [];
      const catalogByKey = new Map(catalogRows.map((row) => [evalKey(row.kind, row.tmdbId), row]));

      const candidates = new Map<string, TonightTitle>();
      await runPool(toScore, CONCURRENCY, async ([key, item]) => {
        const row = catalogByKey.get(key);
        let genres, keywords, people, language, runtime, imdbRating, imdbVotes;
        if (row && (parseStoredPeople(row.tmdbPeople).length > 0 || parseStoredKeywords(row.tmdbKeywords).length > 0)) {
          genres = parseStoredTmdbGenres(row.tmdbGenres);
          keywords = parseStoredKeywords(row.tmdbKeywords);
          people = parseStoredPeople(row.tmdbPeople);
          language = row.originalLanguage;
          runtime = row.runtimeMinutes;
          imdbRating = row.imdbRating ?? item.voteAverage;
          imdbVotes = row.imdbVotes ?? item.voteCount;
        } else {
          const details = await cached(`details:${key}`, () =>
            getTmdbDetails(item.tmdbId, item.kind).catch(() => null),
          );
          if (!details) {
            return;
          }
          genres = details.genres;
          keywords = details.keywords;
          people = parseStoredPeople(details.people);
          language = details.originalLanguage;
          runtime = details.runtimeMinutes;
          // TMDB average stands in for IMDb on titles OMDb has not seen yet.
          imdbRating = item.voteAverage;
          imdbVotes = item.voteCount;
        }
        candidates.set(key, {
          id: key,
          name: item.name,
          kind: item.kind,
          year: item.year,
          runtimeMinutes: runtime ?? null,
          imdbRating: imdbRating ?? null,
          imdbVotes: imdbVotes ?? null,
          genres,
          keywords,
          people,
          originalLanguage: language ?? null,
          platform: null,
          flatrate: [],
          availableOnMine: true,
          watchedAt: null,
          rating: null,
          review: null,
          seriesStatus: null,
          seriesSeason: null,
          listSlugs: [],
          availableSince: null,
          createdAt: now,
        });
      });

      type Scores = Map<string, { engine: number; quality: number; gusto: number }>;
      const scoreAll = (profile: TasteProfile): Scores => {
        const prior = meanImdb([...candidates.values()]);
        const out: Scores = new Map();
        for (const [key, title] of candidates) {
          const vector = itemVector(title);
          const gusto =
            profile.vector.size === 0 ? 0.5 : clamp01(0.5 + cosine(profile.vector, vector) * GUSTO_SCALE);
          const pick = scoreCandidate(title, vector, gusto, {
            profile,
            titlesById: trainById,
            queueById: new Map(),
            eventsByTitle: new Map(),
            qualityPrior: prior,
            now,
          });
          out.set(key, { engine: pick.baseScore, quality: pick.components.calidad, gusto });
        }
        return out;
      };
      const scoresQueue = scoreAll(profileQueue);
      const scoresWatched = scoreAll(baseProfile);
      const rank = (pool: Map<string, Related>, scores: Scores, by: "engine" | "quality" | "gusto") =>
        [...pool.keys()]
          .filter((key) => scores.has(key))
          .sort((a, b) => scores.get(b)![by] - scores.get(a)![by]);

      add("hidden", hidden.size);
      add("queue", queueTitles.length);
      add("seeds", seeds.length);
      for (const name of POOLS) {
        const pool = pools.get(name)!;
        const ranked = rank(pool, scoresQueue, "engine");
        add(`${name}.size`, pool.size);
        add(`${name}.pool`, poolHits(new Set(pool.keys()), hidden));
        add(`${name}.r10`, hitsAtK(ranked, hidden, 10));
        add(`${name}.r30`, hitsAtK(ranked, hidden, 30));
      }
      const prod = pools.get("union_prod")!;
      for (const [label, scores, by] of [
        ["prod_no_queue", scoresWatched, "engine"],
        ["prod_quality", scoresQueue, "quality"],
        ["prod_gusto", scoresQueue, "gusto"],
      ] as const) {
        const ranked = rank(prod, scores, by);
        add(`${label}.r10`, hitsAtK(ranked, hidden, 10));
        add(`${label}.r30`, hitsAtK(ranked, hidden, 30));
      }

      // What the pipeline would cost and how many of its top 30 the user can actually stream.
      const top30 = rank(prod, scoresQueue, "engine").slice(0, 30);
      add("catalog_new", top30.filter((key) => !catalogByKey.has(key)).length);
      if (WITH_PROVIDERS) {
        let available = 0;
        await runPool(top30, CONCURRENCY, async (key) => {
          const item = prod.get(key)!;
          const providers = await cached(`mx:${key}`, () =>
            fetchMxWatchProviders(item.tmdbId, item.kind).catch(() => null),
          );
          if (titleAvailableOnUserPlatforms(providers, input.userPlatforms as Platform[])) {
            available += 1;
          }
        });
        add("available", available);
        add("available_n", top30.length);
      }
      saveCache();
    }

    results.push({ user: userRow.email, folds: folds.length, counts, calls: calls - callsBefore });
    console.log(
      `✓ ${userRow.email}: ${folds.length} pliegues · ${counts.hidden} ocultas · pool prod ${counts["union_prod.pool"]}/${counts.hidden} · r@30 ${counts["union_prod.r30"]}/${counts.hidden} · ${calls - callsBefore} llamadas TMDB`,
    );
  }

  saveCache();
  if (results.length === 0) {
    console.log("Ningún usuario con datos suficientes.");
    return;
  }

  const sum = (key: string) => results.reduce((total, result) => total + (result.counts[key] ?? 0), 0);
  const totalHidden = sum("hidden");
  const totalFolds = results.reduce((total, result) => total + result.folds, 0);
  const rate = (key: string) => pct(totalHidden === 0 ? 0 : sum(key) / totalHidden);
  const hitsOf = (key: string) => `${sum(key)}/${totalHidden}`;

  const lines: string[] = [];
  lines.push(`# Evaluación de fuentes de candidatas · ${now.toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(
    `Usuarios evaluados: **${results.length}** (cuentas clonadas omitidas) · pliegues: **${totalFolds}** · títulos ocultos (pruebas): **${totalHidden}**. Semillas: hasta ${SEED_QUEUE_CAP} de Quiero ver + ${SEED_ANCHOR_CAP} anclas (la fuente «wide» usa hasta ${SEED_WIDE_CAP} vistas con ≥7 como semillas) · géneros discover: ${GENRE_POOLS} · votos ≥ ${MIN_VOTES} · tope de candidatas puntuadas: ${MAX_SCORED} · perfil con cola a peso ${QUEUE_WEIGHT}. Los porcentajes son aciertos / títulos ocultos sumados entre usuarios y pliegues.`,
  );
  lines.push("");
  lines.push("## Por fuente (ordenadas con el motor)");
  lines.push("");
  lines.push("| Fuente | Candidatas por pliegue | En el pool | Top 10 | Top 30 |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const name of POOLS) {
    lines.push(
      `| ${name} | ${(sum(`${name}.size`) / totalFolds).toFixed(0)} | ${hitsOf(`${name}.pool`)} (${rate(`${name}.pool`)}) | ${hitsOf(`${name}.r10`)} (${rate(`${name}.r10`)}) | ${hitsOf(`${name}.r30`)} (${rate(`${name}.r30`)}) |`,
    );
  }
  lines.push("");
  lines.push("## Ordenadores sobre union_prod");
  lines.push("");
  lines.push("| Ordenador | Top 10 | Top 30 |");
  lines.push("|---|---:|---:|");
  lines.push(`| Motor, perfil con Quiero ver | ${hitsOf("union_prod.r10")} (${rate("union_prod.r10")}) | ${hitsOf("union_prod.r30")} (${rate("union_prod.r30")}) |`);
  lines.push(`| Motor, perfil solo vistas | ${hitsOf("prod_no_queue.r10")} (${rate("prod_no_queue.r10")}) | ${hitsOf("prod_no_queue.r30")} (${rate("prod_no_queue.r30")}) |`);
  lines.push(`| Solo gusto (coseno) | ${hitsOf("prod_gusto.r10")} (${rate("prod_gusto.r10")}) | ${hitsOf("prod_gusto.r30")} (${rate("prod_gusto.r30")}) |`);
  lines.push(`| Solo calidad (línea base popularidad) | ${hitsOf("prod_quality.r10")} (${rate("prod_quality.r10")}) | ${hitsOf("prod_quality.r30")} (${rate("prod_quality.r30")}) |`);
  lines.push("");
  lines.push("## Coste y disponibilidad (top 30 de union_prod = semillas amplias + discover con plataformas)");
  lines.push("");
  lines.push(`- Llamadas TMDB por usuario (todos sus pliegues, con caché de disco): **${(results.reduce((t, r) => t + r.calls, 0) / results.length).toFixed(0)}**`);
  lines.push(`- Filas de Catalog nuevas entre el top 30, por pliegue: **${(sum("catalog_new") / totalFolds).toFixed(1)}**`);
  if (WITH_PROVIDERS && sum("available_n") > 0) {
    lines.push(`- Con flatrate en sus plataformas MX: **${pct(sum("available") / sum("available_n"))}**`);
  }
  lines.push("");
  lines.push("## Por usuario");
  lines.push("");
  lines.push("| Usuario | Pliegues | Ocultas | En cola | Pool prod | Top 10 | Top 30 | Llamadas |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|");
  results.forEach((result, index) => {
    const c = result.counts;
    lines.push(
      `| usuario ${index + 1} | ${result.folds} | ${c.hidden} | ${Math.round((c.queue ?? 0) / result.folds)} | ${c["union_prod.pool"]}/${c.hidden} | ${c["union_prod.r10"]}/${c.hidden} | ${c["union_prod.r30"]}/${c.hidden} | ${result.calls} |`,
    );
  });
  const report = lines.join("\n");
  console.log(`\n${report}`);
  const out = flag("out");
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, report);
    console.log(`\nInforme escrito en ${out}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
