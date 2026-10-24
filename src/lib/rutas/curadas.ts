import { and, asc, eq, inArray } from "drizzle-orm";
import { catalog, db, listItems, lists, type CatalogRow } from "@/db";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import {
  parseThreadPeople,
  personStepHint,
  RUTA_MIN_STEPS,
  type RutaDraft,
  type RutaFilm,
  type SeedCandidate,
  type ThreadPerson,
} from "@/lib/rutas/core";

/**
 * Rutas curadas y de temporada (FIL-I26-5): lists Jorge writes as rutas (order + a note per
 * film, `List.curated`), offered when they fit someone's seeds: a film they follow, people in
 * common, or the genres. With a window (`curatedFrom`/`curatedUntil`) they are «de temporada»:
 * offered only inside it, and their rutas are put away in silence when it ends.
 */

export type CuratedItem = { film: CatalogRow; note: string | null };

export type CuratedList = {
  id: string;
  name: string;
  description: string | null;
  curatedFrom: string | null;
  curatedUntil: string | null;
  curatedFor: number[];
  items: CuratedItem[];
};

export type FitSeed = Pick<SeedCandidate, "tmdbId" | "name" | "watched"> & {
  people: readonly ThreadPerson[];
  genreIds: readonly number[];
};

export const curatedSourceKey = (listId: string) => `curada:${listId}`;

export const isCuratedOpen = (list: Pick<CuratedList, "curatedFrom" | "curatedUntil">, today: string) =>
  (!list.curatedFrom || list.curatedFrom <= today) && (!list.curatedUntil || list.curatedUntil >= today);

const filmGenres = (film: CatalogRow) => parseStoredTmdbGenres(film.tmdbGenres).map((genre) => genre.id);

/**
 * How well a curated ruta fits: a seen film it says it follows (strongest), people shared with
 * your films (crew count more), then the genres it leans on. 0 means it does not fit.
 */
export const curatedFit = (list: CuratedList, seeds: readonly FitSeed[]) => {
  const watched = seeds.filter((seed) => seed.watched);
  const follows = watched.filter((seed) => list.curatedFor.includes(seed.tmdbId)).length;
  const yourPeople = new Map<number, ThreadPerson>();
  for (const seed of watched) {
    for (const person of seed.people) {
      yourPeople.set(person.id, person);
    }
  }
  let people = 0;
  const genreCount = new Map<number, number>();
  for (const item of list.items) {
    for (const person of parseThreadPeople(item.film.tmdbPeople)) {
      if (yourPeople.has(person.id)) {
        people += person.role === "cast" ? 1 : 3;
      }
    }
    for (const id of filmGenres(item.film)) {
      genreCount.set(id, (genreCount.get(id) ?? 0) + 1);
    }
  }
  const leaning = [...genreCount.entries()]
    .filter(([, count]) => count >= Math.max(2, Math.ceil(list.items.length / 2)))
    .map(([id]) => id);
  const genres = watched.filter((seed) => seed.genreIds.filter((id) => leaning.includes(id)).length >= 2).length;
  return follows * 10 + people + genres;
};

const toRutaFilm = (film: CatalogRow): RutaFilm => ({
  tmdbId: film.tmdbId,
  name: film.name,
  originalName: film.originalName,
  year: film.year,
  releaseDate: null,
  posterPath: film.posterPath,
  backdropPath: film.backdropPath,
  overview: film.overview,
  voteAverage: film.imdbRating ?? 0,
  voteCount: film.imdbVotes ?? 0,
  genreIds: filmGenres(film),
});

/** The list as a ruta, in its own order; its notes are the whys. Null under 3 films or all seen. */
export const curatedRutaDraft = (
  list: CuratedList,
  seenTmdbIds: ReadonlySet<number>,
  follows: { tmdbId: number; name: string } | null,
): RutaDraft | null => {
  const items = list.items.filter((item) => item.film.kind === "MOVIE");
  if (items.length < RUTA_MIN_STEPS || items.every((item) => seenTmdbIds.has(item.film.tmdbId))) {
    return null;
  }
  return {
    kind: list.curatedUntil ? "temporada" : "curada",
    title: list.name,
    shortTitle: list.name.length > 28 ? `${list.name.slice(0, 27).trimEnd()}…` : list.name,
    reason: list.description?.trim() || (follows ? `Después de ${follows.name}, escrita a mano.` : "Una ruta escrita a mano."),
    sourceKey: curatedSourceKey(list.id),
    seedTmdbId: follows?.tmdbId ?? null,
    endsOn: list.curatedUntil,
    steps: items.map((item, index) => {
      const film = toRutaFilm(item.film);
      return {
        film,
        why: seenTmdbIds.has(film.tmdbId)
          ? "Ya la viste: cuenta"
          : item.note?.trim() || `Parada ${index + 1} de ${items.length}`,
        hint: personStepHint(film),
      };
    }),
  };
};

/** Curated lists open today (any owner), with their films in order. */
export const loadCuratedLists = async (today: string, ids?: readonly string[]): Promise<CuratedList[]> => {
  const rows = await db.query.lists.findMany({
    where: and(eq(lists.curated, true), ...(ids ? [inArray(lists.id, [...ids])] : [])),
    columns: { id: true, name: true, description: true, curatedFrom: true, curatedUntil: true, curatedFor: true },
  });
  const open = rows.filter((row) => isCuratedOpen(row, today));
  if (open.length === 0) {
    return [];
  }
  const items = await db
    .select({ listId: listItems.listId, note: listItems.queueNote, film: catalog })
    .from(listItems)
    .innerJoin(catalog, eq(listItems.catalogId, catalog.id))
    .where(inArray(listItems.listId, open.map((row) => row.id)))
    .orderBy(asc(listItems.listId), asc(listItems.position));
  return open.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    curatedFrom: row.curatedFrom,
    curatedUntil: row.curatedUntil,
    curatedFor: Array.isArray(row.curatedFor) ? row.curatedFor.filter((id): id is number => Number.isInteger(id)) : [],
    items: items.filter((item) => item.listId === row.id).map((item) => ({ film: item.film, note: item.note })),
  }));
};

/** The best fitting curated ruta for these seeds, as a draft; null when none fits. */
export const bestCuratedDraft = (
  curated: readonly CuratedList[],
  seeds: readonly FitSeed[],
  seenTmdbIds: ReadonlySet<number>,
  taken: ReadonlySet<string>,
): RutaDraft | null => {
  const ranked = curated
    .filter((list) => !taken.has(curatedSourceKey(list.id)))
    .map((list) => ({ list, fit: curatedFit(list, seeds) }))
    .filter((item) => item.fit > 0)
    .sort((a, b) => b.fit - a.fit);
  for (const { list } of ranked) {
    const follows = seeds.find((seed) => seed.watched && list.curatedFor.includes(seed.tmdbId)) ?? null;
    const draft = curatedRutaDraft(list, seenTmdbIds, follows);
    if (draft) {
      return draft;
    }
  }
  return null;
};
