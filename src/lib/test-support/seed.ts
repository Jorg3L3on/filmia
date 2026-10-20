import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray } from "drizzle-orm";
import { catalog, db, listItems, listMembers, lists, titles, users, type Platform, type TitleKind } from "@/db";
import { catalogIdFor } from "@/lib/catalog";
import { ensureDefaultLists, WATCHLIST_SLUG } from "@/lib/lists";
import { STREAMING_PLATFORM_TMDB } from "@/lib/streaming-platforms";

/**
 * Fixtures for DB-backed tests on the LOCAL database. Every id is prefixed with the suite's
 * tag so `cleanup` removes exactly what the suite created.
 */
export const seeder = (tag: string) => {
  const userIds: string[] = [];
  const catalogIds: string[] = [];
  let tmdbSeq = 900_000_000 + Math.floor(Math.random() * 1_000_000);

  const user = async (name: string, platforms: Platform[] = []) => {
    const id = `${tag}-${name.toLowerCase()}-${createId().slice(0, 6)}`;
    await db.insert(users).values({
      id,
      email: `${id}@filmia.test`,
      name,
      streamingPlatforms: platforms,
      onboardedAt: new Date(),
    });
    userIds.push(id);
    await ensureDefaultLists(id);
    return id;
  };

  const film = async (input: {
    name: string;
    kind?: TitleKind;
    runtime?: number | null;
    platforms?: Platform[];
    genres?: string[];
    year?: number;
  }) => {
    const tmdbId = tmdbSeq++;
    const kind = input.kind ?? "MOVIE";
    const id = catalogIdFor(kind, tmdbId);
    await db.insert(catalog).values({
      id,
      tmdbId,
      kind,
      name: input.name,
      year: input.year ?? 2020,
      runtimeMinutes: input.runtime ?? null,
      posterPath: `/${tag}.jpg`,
      tmdbGenres: (input.genres ?? ["Drama"]).map((name, index) => ({ id: 18 + index, name })),
      watchProvidersMx: {
        link: null,
        flatrate: (input.platforms ?? []).map((platform) => ({
          providerId: STREAMING_PLATFORM_TMDB[platform].providerIds[0],
          name: platform,
          logoPath: null,
          logoUrl: null,
        })),
        rent: [],
        buy: [],
      },
      watchProvidersFetchedAt: new Date(),
    });
    catalogIds.push(id);
    return { catalogId: id, tmdbId, kind };
  };

  const title = async (userId: string, catalogId: string, fields: { watchedAt?: Date; rating?: number } = {}) => {
    const id = createId();
    await db.insert(titles).values({ id, userId, catalogId, ...fields });
    return id;
  };

  const listOf = async (userId: string, slug: string) =>
    (await db.query.lists.findFirst({ where: and(eq(lists.userId, userId), eq(lists.slug, slug)) }))!;

  const queue = async (userId: string, catalogId: string, position = 0) => {
    const watchlist = await listOf(userId, WATCHLIST_SLUG);
    await db.insert(listItems).values({ listId: watchlist.id, catalogId, addedByUserId: userId, position });
  };

  const collection = async (ownerId: string, name: string, members: { userId: string; role: "EDITOR" | "VIEWER" }[] = []) => {
    const id = createId();
    await db.insert(lists).values({ id, userId: ownerId, name, kind: "COLLECTION", slug: `${tag}-${id.slice(0, 6)}` });
    for (const member of members) await db.insert(listMembers).values({ listId: id, ...member });
    return id;
  };

  const addToList = async (listId: string, catalogId: string, addedBy: string, position = 0) => {
    await db.insert(listItems).values({ listId, catalogId, addedByUserId: addedBy, position });
  };

  const cleanup = async () => {
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
    if (catalogIds.length) await db.delete(catalog).where(inArray(catalog.id, catalogIds));
  };

  return { user, film, title, queue, collection, addToList, listOf, cleanup };
};
