import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";
import { db, listItems, lists, titles, type TitleKind } from "@/db";
import { findCatalogByTmdb, findOrCreateCatalog } from "@/lib/catalog";
import { scheduleCatalogEnrichment } from "@/lib/catalog-enrich";
import { parseOptionalDate } from "@/lib/form-data";
import { TITLE_KINDS } from "@/lib/labels";
import { ensureDefaultLists, WATCHLIST_SLUG } from "@/lib/lists";
import { scheduleTonightRecompute } from "@/lib/tonight-store";

export type AddTitleDestination = "watchlist" | "watched";

export type AddTitleFromTmdbInput = {
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName?: string | null;
  year?: number | null;
  posterPath?: string | null;
  addToWatchlist?: boolean;
  destination?: AddTitleDestination;
  watchedAt?: string | null;
};

export type AddTitleFromTmdbResult =
  | {
      ok: true;
      titleId: string;
      created: boolean;
      addedToWatchlist: boolean;
      markedWatched: boolean;
    }
  | { ok: false; error: string };

const isTitleKind = (value: string): value is TitleKind =>
  TITLE_KINDS.includes(value as TitleKind);

const resolveDestination = (input: AddTitleFromTmdbInput) => {
  if (input.destination === "watched") {
    return { addToWatchlist: false, markWatched: true };
  }

  return {
    addToWatchlist: Boolean(input.addToWatchlist || input.destination === "watchlist"),
    markWatched: false,
  };
};

const enqueueInWatchlist = async (userId: string, titleId: string) => {
  await ensureDefaultLists(userId);

  const watchlist = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
    columns: { id: true },
  });

  if (!watchlist) {
    throw new Error("No se pudo crear Quiero ver.");
  }

  const last = await db.query.listItems.findFirst({
    where: eq(listItems.listId, watchlist.id),
    orderBy: [desc(listItems.position)],
  });

  await db
    .insert(listItems)
    .values({
      listId: watchlist.id,
      titleId,
      position: (last?.position ?? -1) + 1,
    })
    .onConflictDoNothing();
};

const resolveWatchedAt = (value?: string | null) =>
  parseOptionalDate(value ?? null) ?? new Date();

const markExistingWatched = async (
  userId: string,
  titleId: string,
  watchedAt?: string | null,
) => {
  await ensureDefaultLists(userId);

  const watchlist = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
    columns: { id: true },
  });

  const updateTitle = db
    .update(titles)
    .set({ watchedAt: resolveWatchedAt(watchedAt) })
    .where(eq(titles.id, titleId));

  if (!watchlist) {
    await updateTitle;
  } else {
    await db.batch([
      updateTitle,
      db
        .delete(listItems)
        .where(
          and(eq(listItems.listId, watchlist.id), eq(listItems.titleId, titleId)),
        ),
    ]);
  }
};

/**
 * Save a TMDB result for a user. The film lives once in `Catalog`; the user's
 * `Title` only carries what is theirs. A film somebody already saved is
 * complete on the spot — no TMDB/OMDb calls — and only a brand-new catalog
 * row is enriched in the background.
 */
export const upsertTitleFromTmdbForUser = async (
  userId: string,
  input: AddTitleFromTmdbInput,
): Promise<AddTitleFromTmdbResult> => {
  const tmdbId = Number(input.tmdbId);
  const kind = input.kind;
  const snapshotName = input.name.trim();
  const { addToWatchlist, markWatched } = resolveDestination(input);

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return { ok: false, error: "El identificador de TMDB no es válido." };
  }

  if (!isTitleKind(kind)) {
    return { ok: false, error: "El tipo debe ser película o serie." };
  }

  let shared = await findCatalogByTmdb(tmdbId, kind);
  let catalogCreated = false;
  if (!shared) {
    if (!snapshotName) {
      return { ok: false, error: "Falta el nombre del título." };
    }
    const result = await findOrCreateCatalog({
      tmdbId,
      kind,
      name: snapshotName,
      originalName: input.originalName,
      year: input.year,
      posterPath: input.posterPath,
    });
    shared = result.row;
    catalogCreated = result.created;
  }

  const existing = await db.query.titles.findFirst({
    where: and(eq(titles.userId, userId), eq(titles.catalogId, shared.id)),
    columns: { id: true },
  });

  if (existing) {
    if (markWatched) {
      await markExistingWatched(userId, existing.id, input.watchedAt);
    } else if (addToWatchlist) {
      await enqueueInWatchlist(userId, existing.id);
    }

    return {
      ok: true,
      titleId: existing.id,
      created: false,
      addedToWatchlist: addToWatchlist,
      markedWatched: markWatched,
    };
  }

  const titleId = createId();
  const now = new Date();
  await db.insert(titles).values({
    id: titleId,
    userId,
    catalogId: shared.id,
    // Snapshot columns kept in sync for the pre-0010 schema (NOT NULL name/kind);
    // reads go through the catalog, and 0010 drops them.
    name: shared.name,
    originalName: shared.originalName,
    kind,
    year: shared.year,
    tmdbId,
    posterPath: shared.posterPath,
    watchedAt: markWatched ? resolveWatchedAt(input.watchedAt) : null,
    createdAt: now,
    updatedAt: now,
  });

  if (addToWatchlist) {
    await enqueueInWatchlist(userId, titleId);
  }

  if (catalogCreated) {
    scheduleCatalogEnrichment(shared, { userId, titleId });
  } else {
    scheduleTonightRecompute(userId);
  }

  return {
    ok: true,
    titleId,
    created: true,
    addedToWatchlist: addToWatchlist,
    markedWatched: markWatched,
  };
};
