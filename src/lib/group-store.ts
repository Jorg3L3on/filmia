import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { catalog, db, listItems, titles, tonightRecos, users, type Platform } from "@/db";
import { loadUserAffinity } from "@/lib/affinity-store";
import { streamingPlatformsOf } from "@/lib/cine";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import type { ListPerson } from "@/lib/list-invites";
import { personFirstName } from "@/lib/person-avatar";
import { parseStoredStreamingPlatforms } from "@/lib/streaming-platforms";
import { parseStoredKeywords, parseStoredPeople } from "@/lib/tonight-store";
import { filmAsTitle } from "@/lib/tonight/affinity";
import {
  rankForGroup,
  type GroupCandidate,
  type GroupMember,
  type GroupPick,
} from "@/lib/tonight/group";

/**
 * FIL-I19-3 · loading «Qué vemos juntos». Everything comes from the database:
 * each person's library (through the per-instance affinity cache), the list and
 * each person's nightly `TonightReco` pool. No TMDB call while the page loads.
 */

/** Suggestions taken from each person's pool (the best of the nightly run). */
export const GROUP_RECO_PER_MEMBER = 60;

export type GroupFilm = {
  catalogId: string;
  tmdbId: number;
  kind: "MOVIE" | "SERIES";
  name: string;
  year: number | null;
  posterPath: string | null;
  runtimeMinutes: number | null;
  director: string | null;
  /** Who added it, when it is in the list. */
  addedBy: string | null;
  chosen: boolean;
};

export type GroupView = GroupPick & { film: GroupFilm };

export type GroupPageData = {
  watching: { id: string; name: string }[];
  cold: { id: string; name: string }[];
  listCount: number;
  ratedTotal: number;
  sharedPlatforms: Platform[];
  result:
    | { status: "ok"; picks: GroupView[]; relaxed: boolean; platformsUnknown: boolean }
    | { status: "few_ratings" }
    | { status: "no_platform" };
};

const filmColumns = {
  id: catalog.id,
  tmdbId: catalog.tmdbId,
  kind: catalog.kind,
  name: catalog.name,
  year: catalog.year,
  posterPath: catalog.posterPath,
  runtimeMinutes: catalog.runtimeMinutes,
  imdbRating: catalog.imdbRating,
  imdbVotes: catalog.imdbVotes,
  tmdbGenres: catalog.tmdbGenres,
  tmdbKeywords: catalog.tmdbKeywords,
  tmdbPeople: catalog.tmdbPeople,
  originalLanguage: catalog.originalLanguage,
  watchProvidersMx: catalog.watchProvidersMx,
};

export const loadWatchTogether = async (
  listId: string,
  watchingIds: readonly string[],
  people: readonly ListPerson[],
): Promise<GroupPageData> => {
  const ids = [...watchingIds];
  const [affinities, platformRows, watchedRows, listed, pooled] = await Promise.all([
    Promise.all(ids.map((id) => loadUserAffinity(id))),
    db.select({ id: users.id, streamingPlatforms: users.streamingPlatforms }).from(users).where(inArray(users.id, ids)),
    db
      .select({ userId: titles.userId, catalogId: titles.catalogId })
      .from(titles)
      .where(and(inArray(titles.userId, ids), isNotNull(titles.watchedAt))),
    db
      .select({ ...filmColumns, addedByUserId: listItems.addedByUserId, chosenAt: listItems.chosenAt })
      .from(listItems)
      .innerJoin(catalog, eq(catalog.id, listItems.catalogId))
      .where(eq(listItems.listId, listId)),
    db
      .select(filmColumns)
      .from(tonightRecos)
      .innerJoin(catalog, eq(catalog.id, tonightRecos.catalogId))
      .where(and(inArray(tonightRecos.userId, ids), lt(tonightRecos.rank, GROUP_RECO_PER_MEMBER))),
  ]);

  const nameOf = new Map(people.map((person) => [person.id, personFirstName(person.name)]));
  const platformsOf = new Map(platformRows.map((row) => [row.id, parseStoredStreamingPlatforms(row.streamingPlatforms)]));
  const watchedOf = new Map<string, Set<string>>();
  for (const row of watchedRows) {
    const set = watchedOf.get(row.userId) ?? new Set<string>();
    set.add(row.catalogId);
    watchedOf.set(row.userId, set);
  }

  const members: GroupMember[] = ids.map((id, index) => ({
    id,
    name: nameOf.get(id) ?? "Alguien",
    scorer: affinities[index].scorer,
    watched: watchedOf.get(id) ?? new Set(),
    platforms: platformsOf.get(id) ?? [],
  }));

  type Row = (typeof pooled)[number] & { addedByUserId?: string | null; chosenAt?: Date | null };
  const rows = new Map<string, { row: Row; inList: boolean }>();
  for (const row of listed) {
    rows.set(row.id, { row, inList: true });
  }
  for (const row of pooled) {
    if (!rows.has(row.id)) {
      rows.set(row.id, { row, inList: false });
    }
  }

  const candidates: GroupCandidate[] = [];
  for (const { row, inList } of rows.values()) {
    candidates.push({
      catalogId: row.id,
      inList,
      platforms: streamingPlatformsOf(row.watchProvidersMx),
      title: filmAsTitle({
        id: row.id,
        name: row.name,
        kind: row.kind,
        year: row.year,
        imdbRating: row.imdbRating,
        imdbVotes: row.imdbVotes,
        genres: parseStoredTmdbGenres(row.tmdbGenres),
        keywords: parseStoredKeywords(row.tmdbKeywords),
        people: parseStoredPeople(row.tmdbPeople),
        originalLanguage: row.originalLanguage,
      }),
    });
  }

  const ranked = rankForGroup(members, candidates);
  const shared = members.reduce<Platform[] | null>(
    (acc, member) => (acc == null ? [...member.platforms] : acc.filter((p) => member.platforms.includes(p))),
    null,
  );
  const base = {
    watching: members.map((member) => ({ id: member.id, name: member.name })),
    cold: members.filter((member) => !member.scorer).map((member) => ({ id: member.id, name: member.name })),
    listCount: listed.length,
    ratedTotal: affinities.reduce((sum, affinity) => sum + affinity.ratedCount, 0),
    sharedPlatforms: shared ?? [],
  };
  if (ranked.status !== "ok") {
    return { ...base, result: { status: ranked.status } };
  }

  const candidateById = new Map(candidates.map((candidate) => [candidate.catalogId, candidate]));
  const picks: GroupView[] = ranked.picks.map((pick) => {
    const { row } = rows.get(pick.catalogId)!;
    const title = candidateById.get(pick.catalogId)!.title;
    const director = title.people.find((person) => person.role === "director" || person.role === "creator");
    return {
      ...pick,
      film: {
        catalogId: row.id,
        tmdbId: row.tmdbId,
        kind: row.kind,
        name: row.name,
        year: row.year,
        posterPath: row.posterPath,
        runtimeMinutes: row.runtimeMinutes,
        director: director?.name ?? null,
        addedBy: row.addedByUserId ? (nameOf.get(row.addedByUserId) ?? null) : null,
        chosen: row.chosenAt != null,
      },
    };
  });
  return {
    ...base,
    result: { status: "ok", picks, relaxed: ranked.relaxed, platformsUnknown: ranked.platformsUnknown },
  };
};

/** The film the group picked on this list, if any («Vamos con esta»). */
export const chosenOfList = async (listId: string) => {
  const [row] = await db
    .select({
      catalogId: listItems.catalogId,
      chosenAt: listItems.chosenAt,
      chosenByUserId: listItems.chosenByUserId,
      name: catalog.name,
      year: catalog.year,
      posterPath: catalog.posterPath,
    })
    .from(listItems)
    .innerJoin(catalog, eq(catalog.id, listItems.catalogId))
    .where(and(eq(listItems.listId, listId), isNotNull(listItems.chosenAt)))
    .limit(1);
  return row ?? null;
};

