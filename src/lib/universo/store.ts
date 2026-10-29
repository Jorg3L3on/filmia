import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray } from "drizzle-orm";
import { catalog, db, pickEvents, users } from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";
import { buildPersonSearchHref } from "@/lib/person-filmography";
import { runPool } from "@/lib/run-pool";
import {
  parseThreadPeople,
  personRoleFilms,
  pickEsenciales,
  PERSON_FULL_MAX,
  todayIso,
  type PersonFilm,
  type PersonRole,
  type ThreadPersonRole,
} from "@/lib/people/core";
import { loadLibraryContext, loadWatchedFilms, platformLabelOf } from "@/lib/people/store";
import { personSourceKey } from "@/lib/rutas/core";
import { personDraft } from "@/lib/rutas/factories";
import { loadSourceKeys } from "@/lib/rutas/store";
import { parseStoredStreamingPlatforms } from "@/lib/streaming-platforms";
import { getTmdbDetails, getTmdbPersonCredits, isTmdbConfigured } from "@/lib/tmdb";
import { parseStoredTmdbPeople } from "@/lib/tmdb-people";
import {
  bridgeRevealOf,
  buildUniverso,
  closestIsland,
  mostBridges,
  newBridge,
  ROLE_LABEL,
  rutaRoleOf,
  type BridgeReveal,
  type ClosestIsland,
  type Universo,
  type UniversoFilm,
} from "@/lib/universo/core";
import { withTimeout } from "@/lib/with-timeout";

/**
 * «Tu universo» server side (FIL-I26-4). The people come from `Catalog.tmdbPeople`; «N» (their
 * films in that role) from TMDB's credits, the same cached answers Filmografía reads, within a
 * budget so Perfil never waits on TMDB for long.
 */

const TOTALS_CONCURRENCY = 6;
const TOTAL_BUDGET_MS = 1500;
/** Watched films whose stored people predate the composer: refreshed after the response, a few per visit. */
const COMPOSER_REFRESH_PER_VISIT = 8;

export const loadUniversoFilms = async (userId: string): Promise<UniversoFilm[]> => {
  const rows = await loadWatchedFilms(userId);
  return rows.map(({ title, film }) => ({
    catalogId: film.id,
    tmdbId: film.tmdbId,
    name: film.name,
    year: film.year,
    posterPath: film.posterPath,
    watchedAt: title.watchedAt ?? title.createdAt,
    people: parseThreadPeople(film.tmdbPeople),
  }));
};

/**
 * Rows stored before the composer existed get it after the response (TMDB details, cached), so
 * music bridges (Zimmer) show up without a manual backfill. Never writes an empty list.
 */
const scheduleComposerRefresh = (films: readonly UniversoFilm[]) => {
  if (!isTmdbConfigured()) {
    return;
  }
  const stale = films.filter((film) => !film.people.some((person) => person.role === "composer"));
  if (stale.length === 0) {
    return;
  }
  scheduleAfterResponse(async () => {
    const rows = await db.query.catalog.findMany({
      where: inArray(catalog.id, stale.slice(0, COMPOSER_REFRESH_PER_VISIT).map((film) => film.catalogId)),
      columns: { id: true, tmdbId: true, kind: true, tmdbPeople: true },
    });
    for (const row of rows) {
      try {
        const details = await getTmdbDetails(row.tmdbId, row.kind);
        const hasComposer = details.people.some((person) => person.role === "composer");
        if (hasComposer && parseStoredTmdbPeople(row.tmdbPeople).every((person) => person.role !== "composer")) {
          await db.update(catalog).set({ tmdbPeople: details.people }).where(eq(catalog.id, row.id));
        }
      } catch {
        // Next visit tries again.
      }
    }
  });
};

/** «N» for each person: their films in that role, TMDB within a budget (unknown stays null). */
export const loadTotals = async (people: ReadonlyArray<{ id: number; role: ThreadPersonRole }>) => {
  const totals = new Map<number, number>();
  if (!isTmdbConfigured() || people.length === 0) {
    return totals;
  }
  const today = todayIso();
  const work = runPool(people, TOTALS_CONCURRENCY, async (person) => {
    try {
      const credits = await getTmdbPersonCredits(person.id);
      totals.set(person.id, personRoleFilms(credits.credits, rutaRoleOf(person.role), today).length);
    } catch {
      // Unknown: drawn without a ring.
    }
  });
  await withTimeout(work, TOTAL_BUDGET_MS, undefined);
  return totals;
};

export type UniversoView = {
  universo: Universo;
  closest: (ClosestIsland & { next: { name: string; platformLabel: string | null } | null; sourceKey: string; started: boolean }) | null;
};

/**
 * The universe for Perfil. `scope: "summary"` only counts the directors (enough for «cierra la más
 * chica»); `"full"` also counts everyone in two films or more (the rings of the map).
 */
export const loadUniverso = async (userId: string, scope: "summary" | "full"): Promise<UniversoView> => {
  const films = await loadUniversoFilms(userId);
  scheduleComposerRefresh(films);
  const draft = buildUniverso(films);
  const counted = draft.islands
    .flatMap((island) => island.nodes)
    .filter((node) => node.role === "director" || (scope === "full" && node.count >= 2));
  const totals = await loadTotals(
    counted.flatMap((node) => node.personIds.slice(0, 1).map((id) => ({ id, role: node.role }))).slice(0, 30),
  );
  // A duo shares its «N»: the first person's count stands for both.
  for (const node of counted) {
    const first = totals.get(node.personIds[0]!);
    for (const id of node.personIds.slice(1)) {
      if (first != null) {
        totals.set(id, first);
      }
    }
  }
  const universo = buildUniverso(films, totals);
  const closest = closestIsland(universo.islands.flatMap((island) => island.nodes));
  if (!closest) {
    return { universo, closest: null };
  }
  const sourceKey = personSourceKey(closest.node.personIds, "director");
  const [used, next] = await Promise.all([loadSourceKeys(userId), nextFilmOf(userId, closest.node.personIds)]);
  return { universo, closest: { ...closest, next, sourceKey, started: used.has(sourceKey) } };
};

/** The next film of a director's ruta (what «cierra la más chica» proposes). */
const nextFilmOf = async (userId: string, personIds: readonly number[]) => {
  if (!isTmdbConfigured()) {
    return null;
  }
  try {
    const ctx = await loadLibraryContext(userId);
    const draft = await withTimeout(personDraft(personIds, "director", ctx, null), TOTAL_BUDGET_MS, null);
    const step = draft?.steps.find((item) => !ctx.seenTmdbIds.has(item.film.tmdbId));
    if (!step) {
      return null;
    }
    const film = await db.query.catalog.findFirst({
      where: and(eq(catalog.tmdbId, step.film.tmdbId), eq(catalog.kind, "MOVIE")),
    });
    return { name: step.film.name, platformLabel: film ? platformLabelOf(film, ctx.platforms) : null };
  } catch {
    return null;
  }
};

export type UniversoPerson = {
  key: string;
  name: string;
  roleLabel: string;
  /** The first film of yours with them («entró con PHM»). */
  firstFilm: string | null;
  count: number;
  total: number | null;
  bridges: number;
  /** The ruta of this person: whole (≤ 8) or «esenciales». */
  ruta: { sourceKey: string; title: string; size: number; whole: boolean; started: boolean; names: string[] } | null;
  mostBridges: { name: string; people: string[]; platformLabel: string | null; runtime: number | null } | null;
  filmographyHref: string | null;
};

/** U3 · a person's sheet: how far you are, their ruta and the film that opens most bridges. */
export const loadUniversoPerson = async (userId: string, key: string): Promise<UniversoPerson | null> => {
  const personIds = key.split("+").map(Number).filter((id) => Number.isInteger(id) && id > 0);
  if (personIds.length === 0) {
    return null;
  }
  const films = await loadUniversoFilms(userId);
  const universo = buildUniverso(films, new Map(), Number.POSITIVE_INFINITY);
  const node = universo.islands.flatMap((island) => island.nodes).find((item) => item.key === key);
  if (!node) {
    return null;
  }
  const role = node.role;
  const rutaRole = rutaRoleOf(role) as PersonRole;
  const base: UniversoPerson = {
    key,
    name: node.name,
    roleLabel: ROLE_LABEL[role],
    firstFilm: films.find((film) => film.catalogId === node.films[0])?.name ?? null,
    count: node.count,
    total: null,
    bridges: node.bridge ? node.count - 1 : 0,
    ruta: null,
    mostBridges: null,
    filmographyHref:
      role === "composer"
        ? null
        : buildPersonSearchHref({ personId: personIds[0]!, role: rutaRole as "director" | "fotografia" | "reparto", name: node.name }),
  };
  if (!isTmdbConfigured()) {
    return base;
  }
  try {
    const [ctx, used, user] = await Promise.all([
      loadLibraryContext(userId),
      loadSourceKeys(userId),
      db.query.users.findFirst({ where: eq(users.id, userId), columns: { streamingPlatforms: true } }),
    ]);
    const credits = await getTmdbPersonCredits(personIds[0]!);
    const all = personRoleFilms(credits.credits, rutaRole, ctx.today);
    const draft = await personDraft(personIds, rutaRole, ctx, null);
    const steps: PersonFilm[] = draft?.steps.map((step) => step.film) ?? (all.length <= PERSON_FULL_MAX ? all : pickEsenciales(all, ctx.seenTmdbIds, new Set()));
    const unseen = steps.filter((film) => !ctx.seenTmdbIds.has(film.tmdbId)).slice(0, 6);
    const candidates = await Promise.all(
      unseen.map(async (film) => {
        const details = await getTmdbDetails(film.tmdbId, "MOVIE").catch(() => null);
        return {
          tmdbId: film.tmdbId,
          name: film.name,
          releaseDate: film.releaseDate,
          runtime: details?.runtimeMinutes ?? null,
          people: details ? parseThreadPeople(details.people) : [],
        };
      }),
    );
    const universePeople = new Set(films.flatMap((film) => film.people.map((person) => person.id)));
    const best = mostBridges(candidates, personIds, universePeople);
    const bestRow = best
      ? await db.query.catalog.findFirst({ where: and(eq(catalog.tmdbId, best.film.tmdbId), eq(catalog.kind, "MOVIE")) })
      : null;
    const platforms = parseStoredStreamingPlatforms(user?.streamingPlatforms);
    return {
      ...base,
      total: all.length,
      ruta: draft
        ? {
            sourceKey: draft.sourceKey,
            title: draft.title,
            size: draft.steps.length,
            whole: all.length <= PERSON_FULL_MAX,
            started: used.has(draft.sourceKey),
            names: draft.steps.map((step) => step.film.name),
          }
        : null,
      mostBridges: best
        ? {
            name: best.film.name,
            people: best.people.slice(0, 3),
            platformLabel: bestRow ? platformLabelOf(bestRow, platforms) : null,
            runtime: candidates.find((item) => item.tmdbId === best.film.tmdbId)?.runtime ?? null,
          }
        : null,
    };
  } catch {
    return base;
  }
};

export type { BridgeReveal } from "@/lib/universo/core";

/**
 * U4 · after «Vi esto»: did the film just seen make a bridge (someone already in a film of yours
 * by another director)? Each person is revealed once (`universo_bridge`).
 */
export const bridgeAfterWatch = async (userId: string, cardId: string): Promise<BridgeReveal | null> => {
  const films = await loadUniversoFilms(userId);
  const ownedTitle = await db.query.titles.findFirst({
    where: (table, { and: both, eq: equals, or }) => both(equals(table.userId, userId), or(equals(table.id, cardId), equals(table.catalogId, cardId))),
    columns: { catalogId: true },
  });
  const seen = films.find((film) => film.catalogId === (ownedTitle?.catalogId ?? cardId));
  if (!seen) {
    return null;
  }
  const shown = await db.query.pickEvents.findMany({
    where: and(eq(pickEvents.userId, userId), eq(pickEvents.kind, "universo_bridge")),
    columns: { lens: true },
  });
  const already = new Set(shown.flatMap((event) => (event.lens?.startsWith("universo:") ? [Number(event.lens.slice(9))] : [])));
  const found = newBridge(seen, films.filter((film) => film !== seen), already);
  if (!found) {
    return null;
  }
  await db.insert(pickEvents).values({
    id: createId(),
    userId,
    titleId: null,
    catalogId: seen.catalogId,
    kind: "universo_bridge",
    lens: `universo:${found.person.id}`,
    createdAt: new Date(),
  });
  const totals = await loadTotals([{ id: found.person.id, role: found.person.role }]);
  return bridgeRevealOf(seen, found, totals.get(found.person.id) ?? null);
};
