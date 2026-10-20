import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { cache } from "react";
import { catalog, db, titles } from "@/db";
import { loadUserAffinity } from "@/lib/affinity-store";
import {
  compatibility,
  compatPhrase,
  groupCompatibility,
  type Compat,
  type CompatPerson,
} from "@/lib/compat";
import { deciders } from "@/lib/group-access";
import { getListPeople, type ListPerson } from "@/lib/list-invites";
import { personFirstName } from "@/lib/person-avatar";
import { compatShareId, parseCompatShareId, sharePath, verifyShareToken } from "@/lib/share-token";

/**
 * FIL-I19-4 · loading «% de compatibilidad». Only the owner and editors of a
 * list count (pinned decision); each one sees their own % with every other
 * one and the group's, never the % between two other people.
 */

type LoadedPerson = CompatPerson & { genreNames: ReadonlyMap<number, string> };

const loadCompatPerson = cache(async (userId: string): Promise<LoadedPerson> => {
  const [rows, affinity] = await Promise.all([
    db
      .select({ catalogId: titles.catalogId, rating: titles.rating })
      .from(titles)
      .where(and(eq(titles.userId, userId), isNotNull(titles.watchedAt), isNotNull(titles.rating))),
    loadUserAffinity(userId),
  ]);
  const profile = affinity.scorer?.ctx.profile;
  const genreNames = new Map<number, string>();
  for (const title of affinity.scorer?.titlesById.values() ?? []) {
    for (const genre of title.genres) {
      genreNames.set(genre.id, genre.name);
    }
  }
  return {
    ratings: new Map(rows.map((row) => [row.catalogId, row.rating!])),
    vector: profile?.vector ?? new Map(),
    genreAffinity: profile?.genreAffinity,
    genreNames,
  };
});

export type CompatFilmView = { catalogId: string; name: string; year: number | null; posterPath: string | null };

export type CompatCard = {
  percent: number;
  approx: boolean;
  common: number;
  phrase: string;
  genres: string[];
  bothLove: CompatFilmView[];
  /** Only inside the app, never on the shared card (canvas 2·3). */
  disagree: CompatFilmView | null;
};

const filmsById = async (ids: readonly string[]) => {
  if (ids.length === 0) {
    return new Map<string, CompatFilmView>();
  }
  const rows = await db
    .select({ catalogId: catalog.id, name: catalog.name, year: catalog.year, posterPath: catalog.posterPath })
    .from(catalog)
    .where(inArray(catalog.id, [...ids]));
  return new Map(rows.map((row) => [row.catalogId, row]));
};

const toCard = async (compat: Compat, a: LoadedPerson): Promise<CompatCard> => {
  const films = await filmsById([...compat.bothLove, ...(compat.disagree ? [compat.disagree] : [])]);
  const bothLove = compat.bothLove.flatMap((id) => films.get(id) ?? []);
  const genres = compat.sharedGenreIds.flatMap((id) => a.genreNames.get(id) ?? []);
  return {
    percent: compat.percent,
    approx: compat.approx,
    common: compat.common,
    phrase: compatPhrase(compat, genres, bothLove.map((film) => film.name)),
    genres,
    bothLove,
    disagree: compat.disagree ? (films.get(compat.disagree) ?? null) : null,
  };
};

export type MemberCompat = {
  /** `name` is the first name for the text, `fullName` feeds the avatar's initials. */
  pairs: {
    other: { id: string; name: string; fullName: string | null };
    card: CompatCard | null;
    sharePath: string | null;
  }[];
  group: { percent: number; approx: boolean } | null;
};

/** The viewer's block in Miembros, or null for readers and lists without a group. */
export const loadMemberCompat = async (
  listId: string,
  viewerId: string,
  people: readonly ListPerson[],
): Promise<MemberCompat | null> => {
  const counted = deciders(people);
  if (counted.length < 2 || !counted.some((person) => person.id === viewerId)) {
    return null;
  }
  const loaded = new Map(
    await Promise.all(counted.map(async (person) => [person.id, await loadCompatPerson(person.id)] as const)),
  );
  const me = loaded.get(viewerId)!;

  const pairs = await Promise.all(
    counted
      .filter((person) => person.id !== viewerId)
      .map(async (person) => {
        const compat = compatibility(me, loaded.get(person.id)!);
        return {
          other: { id: person.id, name: personFirstName(person.name), fullName: person.name },
          card: compat ? await toCard(compat, me) : null,
          sharePath: compat ? sharePath("compat", compatShareId(listId, viewerId, person.id)) : null,
        };
      }),
  );
  pairs.sort((x, y) => (y.card?.percent ?? -1) - (x.card?.percent ?? -1));

  // The group's % uses every pair of deciders; only the mean is shown.
  const all: (Compat | null)[] = [];
  for (let i = 0; i < counted.length; i += 1) {
    for (let j = i + 1; j < counted.length; j += 1) {
      all.push(compatibility(loaded.get(counted[i].id)!, loaded.get(counted[j].id)!));
    }
  }
  const group = counted.length > 2 ? groupCompatibility(all) : null;
  return { pairs, group: group ? { percent: group.percent, approx: group.approx } : null };
};

export type SharedCompat = {
  names: [string, string];
  card: Omit<CompatCard, "disagree">;
};

/**
 * The public card (`/compartir/compat/<token>`): null for a bad token, or when
 * either person no longer owns or edits the list (leaving retires the link).
 * First names only, never a rating or «donde no coinciden».
 */
export const getSharedCompat = cache(async (token: string): Promise<SharedCompat | null> => {
  const id = verifyShareToken("compat", token);
  const parsed = id ? parseCompatShareId(id) : null;
  if (!parsed) {
    return null;
  }
  const people = await getListPeople(parsed.listId);
  const counted = deciders(people);
  const a = counted.find((person) => person.id === parsed.userA);
  const b = counted.find((person) => person.id === parsed.userB);
  if (!a || !b) {
    return null;
  }
  const [pa, pb] = await Promise.all([loadCompatPerson(a.id), loadCompatPerson(b.id)]);
  const compat = compatibility(pa, pb);
  if (!compat) {
    return null;
  }
  const full = await toCard(compat, pa);
  return {
    names: [personFirstName(a.name), personFirstName(b.name)],
    card: {
      percent: full.percent,
      approx: full.approx,
      common: full.common,
      phrase: full.phrase,
      genres: full.genres,
      bothLove: full.bothLove,
    },
  };
});
