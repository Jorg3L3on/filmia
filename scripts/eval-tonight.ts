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
 *                           [--max-scored=400] [--no-providers] [--cache=<file.json>]
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
  const { evalKey, mean, pct, poolRecall, recallAtK, splitHoldout } = await import(
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

  type Row = Record<string, number | string>;
  const perUser: Row[] = [];
  const now = new Date();

  for (const userRow of userRows) {
    if (limit > 0 && perUser.length >= limit) {
      break;
    }
    const input = await loadTonightInput(userRow.id, now);
    const split = splitHoldout(input.titles);
    if (!split) {
      console.log(`— ${userRow.email}: pocas vistas con nota, se omite`);
      continue;
    }
    const callsBefore = calls;
    const rowById = new Map(input.rows.map((row) => [row.id, row]));
    const keyOfTitle = (id: string) => {
      const row = rowById.get(id);
      return row ? evalKey(row.kind, row.tmdbId) : null;
    };
    const hidden = new Set(split.holdout.map((title) => keyOfTitle(title.id)!));
    const library = new Set(split.train.map((title) => keyOfTitle(title.id)!));
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

    // Seeds: first of Quiero ver + the user's anchors (high ratings / Favoritas).
    const seedIds = [
      ...queueTitles.slice(0, SEED_QUEUE_CAP).map((title) => title.id),
      ...baseProfile.anchors.slice(0, SEED_ANCHOR_CAP).map((anchor) => anchor.titleId),
    ];
    const seeds = [...new Set(seedIds)].flatMap((id) => {
      const row = rowById.get(id);
      return row ? [{ tmdbId: row.tmdbId, kind: row.kind as TitleKind }] : [];
    });

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

    const jobs: Array<() => Promise<void>> = [];
    for (const seed of seeds) {
      for (const relation of ["recommendations", "similar"] as const) {
        jobs.push(async () => {
          const items = await cached(`${relation}:${seed.kind}:${seed.tmdbId}`, () =>
            getTmdbRelated(seed.tmdbId, seed.kind, relation).catch(() => [] as Related[]),
          );
          addTo(relation, items);
        });
      }
    }
    for (const kind of kinds) {
      for (const genreId of topGenres) {
        jobs.push(async () => {
          const plain = await cached(`discover:${kind}:${genreId}`, () =>
            discoverTmdb({ kind, withGenres: [genreId], voteCountGte: MIN_VOTES }).catch(() => [] as Related[]),
          );
          addTo("discover", plain);
        });
        if (providerIds.length > 0) {
          jobs.push(async () => {
            const mx = await cached(`discover-mx:${kind}:${genreId}:${providerIds.join("|")}`, () =>
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

    for (const name of ["recommendations", "similar", "discover", "discover_mx"]) {
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
    pools.set("union_prod", union(["recommendations", "discover_mx"]));
    pools.set("union_all", union(["recommendations", "similar", "discover", "discover_mx"]));

    // Which sources reached each candidate: the cap keeps the multi-source ones first.
    const hits = new Map<string, number>();
    for (const name of ["recommendations", "similar", "discover", "discover_mx"]) {
      for (const key of pools.get(name)!.keys()) {
        hits.set(key, (hits.get(key) ?? 0) + 1);
      }
    }
    const everything = pools.get("union_all")!;
    const toScore = [...everything.entries()]
      .filter(([, item]) => item.voteCount >= 100)
      .sort((a, b) => (hits.get(b[0]) ?? 0) - (hits.get(a[0]) ?? 0) || b[1].voteCount - a[1].voteCount)
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

    const scoreAll = (profile: TasteProfile) => {
      const prior = meanImdb([...candidates.values()]);
      const out = new Map<string, { engine: number; quality: number; gusto: number }>();
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

    const rank = (
      pool: Map<string, Related>,
      scores: Map<string, { engine: number; quality: number; gusto: number }>,
      by: "engine" | "quality" | "gusto",
    ) =>
      [...pool.keys()]
        .filter((key) => scores.has(key))
        .sort((a, b) => scores.get(b)![by] - scores.get(a)![by]);

    const row: Row = {
      user: userRow.email,
      rated: split.train.filter((t) => t.rating != null).length + split.holdout.length,
      hidden: hidden.size,
      queue: queueTitles.length,
      seeds: seeds.length,
    };
    for (const name of ["recommendations", "similar", "discover", "discover_mx", "union_prod", "union_all"]) {
      const pool = pools.get(name)!;
      const ranked = rank(pool, scoresQueue, "engine");
      row[`${name}.size`] = pool.size;
      row[`${name}.pool`] = poolRecall(new Set(pool.keys()), hidden);
      row[`${name}.r10`] = recallAtK(ranked, hidden, 10);
      row[`${name}.r30`] = recallAtK(ranked, hidden, 30);
    }
    const prod = pools.get("union_prod")!;
    for (const [label, scores, by] of [
      ["prod_no_queue", scoresWatched, "engine"],
      ["prod_quality", scoresQueue, "quality"],
      ["prod_gusto", scoresQueue, "gusto"],
    ] as const) {
      const ranked = rank(prod, scores, by);
      row[`${label}.r10`] = recallAtK(ranked, hidden, 10);
      row[`${label}.r30`] = recallAtK(ranked, hidden, 30);
    }

    // What the pipeline would cost and how many of its top 30 the user can actually stream.
    const top30 = rank(prod, scoresQueue, "engine").slice(0, 30);
    row["catalog_new"] = top30.filter((key) => !catalogByKey.has(key)).length;
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
      row["available30"] = top30.length > 0 ? available / top30.length : 0;
    }
    row["tmdb_calls"] = calls - callsBefore;
    perUser.push(row);
    saveCache();
    console.log(
      `✓ ${userRow.email}: ${hidden.size} ocultas · union_prod pool ${pct(row["union_prod.pool"] as number)} · r@30 ${pct(row["union_prod.r30"] as number)} · ${row.tmdb_calls} llamadas TMDB`,
    );
  }

  saveCache();
  if (perUser.length === 0) {
    console.log("Ningún usuario con datos suficientes.");
    return;
  }

  const avg = (key: string) => mean(perUser.map((row) => Number(row[key] ?? 0)));
  const lines: string[] = [];
  lines.push(`# Evaluación de fuentes de candidatas · ${now.toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(
    `Usuarios evaluados: **${perUser.length}** · semillas: hasta ${SEED_QUEUE_CAP} de Quiero ver + ${SEED_ANCHOR_CAP} anclas · géneros discover: ${GENRE_POOLS} · votos ≥ ${MIN_VOTES} · tope de candidatas puntuadas: ${MAX_SCORED} · perfil con cola a peso ${QUEUE_WEIGHT}.`,
  );
  lines.push("");
  lines.push("## Por fuente (ordenadas con el motor)");
  lines.push("");
  lines.push("| Fuente | Candidatas (media) | Recall del pool | Recall@10 | Recall@30 |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const name of ["recommendations", "similar", "discover", "discover_mx", "union_prod", "union_all"]) {
    lines.push(
      `| ${name} | ${avg(`${name}.size`).toFixed(0)} | ${pct(avg(`${name}.pool`))} | ${pct(avg(`${name}.r10`))} | ${pct(avg(`${name}.r30`))} |`,
    );
  }
  lines.push("");
  lines.push("## Ordenadores sobre union_prod");
  lines.push("");
  lines.push("| Ordenador | Recall@10 | Recall@30 |");
  lines.push("|---|---:|---:|");
  lines.push(`| Motor, perfil con Quiero ver | ${pct(avg("union_prod.r10"))} | ${pct(avg("union_prod.r30"))} |`);
  lines.push(`| Motor, perfil solo vistas | ${pct(avg("prod_no_queue.r10"))} | ${pct(avg("prod_no_queue.r30"))} |`);
  lines.push(`| Solo gusto (coseno) | ${pct(avg("prod_gusto.r10"))} | ${pct(avg("prod_gusto.r30"))} |`);
  lines.push(`| Solo calidad (línea base popularidad) | ${pct(avg("prod_quality.r10"))} | ${pct(avg("prod_quality.r30"))} |`);
  lines.push("");
  lines.push("## Coste y disponibilidad (top 30 de union_prod)");
  lines.push("");
  lines.push(`- Llamadas TMDB por usuario (media, con caché de disco): **${avg("tmdb_calls").toFixed(0)}**`);
  lines.push(`- Filas de Catalog nuevas entre el top 30 (media): **${avg("catalog_new").toFixed(1)}**`);
  if (WITH_PROVIDERS) {
    lines.push(`- Con flatrate en sus plataformas MX: **${pct(avg("available30"))}**`);
  }
  lines.push("");
  lines.push("## Por usuario");
  lines.push("");
  lines.push("| Usuario | Con nota | Ocultas | En cola | Semillas | Pool prod | R@10 | R@30 | Llamadas |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  perUser.forEach((row, index) => {
    lines.push(
      `| usuario ${index + 1} | ${row.rated} | ${row.hidden} | ${row.queue} | ${row.seeds} | ${pct(Number(row["union_prod.pool"]))} | ${pct(Number(row["union_prod.r10"]))} | ${pct(Number(row["union_prod.r30"]))} | ${row.tmdb_calls} |`,
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
