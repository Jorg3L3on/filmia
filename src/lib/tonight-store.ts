import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import {
  catalog,
  db,
  listItems,
  lists,
  pickEvents,
  titles,
  tonightPicks,
  tonightRecos,
  users,
  type CatalogRow,
  type Platform,
  type Title,
} from "@/db";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { scheduleAfterResponse } from "@/lib/after-response";
import { flattenTitle } from "@/lib/catalog-core";
import { toCoverflowTitle } from "@/lib/coverflow-title";
import { scheduleDiaryWatchlistEnrichment } from "@/lib/diary-enrich";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { WATCHLIST_SLUG } from "@/lib/lists";
import {
  isPickEventKind,
  PICK_EVENT_KINDS,
  toTonightEvents,
} from "@/lib/tonight/events";
import { blockedItemIds } from "@/lib/tonight/candidates";
import { composeLenses, type RecoEntry } from "@/lib/tonight/compose";
import { itemVector } from "@/lib/tonight/features";
import { PARA_TI_NAME, PARA_TI_SLUG } from "@/lib/tonight/select";
import { findPinnedTitleId, PIN_WINDOW_MS, PINNED_REASON } from "@/lib/tonight/pin";
import {
  parseStoredStreamingPlatforms,
  titleAvailableOnUserPlatforms,
} from "@/lib/streaming-platforms";
import {
  computeTonight,
  parseNightEnds,
  type NightEnds,
  type PickEventKind,
  type TonightComponents,
  type TonightEvent,
  type TonightInput,
  type TonightKeyword,
  type TonightLensKind,
  type TonightPerson,
  type TonightPickBase,
  type TonightQueueEntry,
  type TonightReason,
  type TonightResult,
  type TonightTitle,
} from "@/lib/tonight";
import { parseStoredWatchProviders } from "@/lib/watch-providers";

export const TONIGHT_STALE_MS = 24 * 60 * 60 * 1000;
export const TONIGHT_EVENTS_WINDOW_DAYS = 30;

export { isPickEventKind, PICK_EVENT_KINDS };

/** What the sala receives: a coverflow card plus everything the ranker and the reasons need. */
export type TonightCard = CoverflowTitle & {
  runtimeMinutes: number | null;
  components: TonightComponents;
  reasons: TonightReason[];
  wildcard: boolean;
  /** Chosen from Quiero ver for tonight: stays first in Para ti. */
  pinned: boolean;
  posterAmbient: string | null;
  queueNote: string | null;
  overview: string | null;
  /** Directors / creators with their TMDB ids («Dirigida por» links to Buscar). */
  leads: TonightPerson[];
  /** `reco`: recommended and not in the library, so `id` is the film's catalog id (FIL-I6). */
  source: "queue" | "reco";
  reco: { tmdbId: number; seedName: string | null; sourceKind: "recommendations" | "discover" } | null;
};

export type TonightLensView = {
  slug: string;
  name: string;
  kind: TonightLensKind;
  titles: TonightCard[];
};

export type TonightDecks = {
  lenses: TonightLensView[];
  nightEnds: NightEnds;
  userPlatforms: Platform[];
  profileSize: number;
  computedAt: string;
  /** Watchlist titles exist but none streams on the user's platforms. */
  queueSize: number;
};

type TitleRowWithLists = Title & {
  listItems: Array<{
    position: number;
    addedAt: Date;
    queueNote: string | null;
    list: { id: string; slug: string | null };
  }>;
};

const TITLE_WITH_LISTS = {
  catalog: true,
  listItems: {
    with: { list: { columns: { id: true, slug: true } } },
  },
} as const;

/** Rows come with their catalog; the sala works on the flat `Title` shape. */
const loadTitleRows = async (where: SQL | undefined): Promise<TitleRowWithLists[]> => {
  const rows = await db.query.titles.findMany({ where, with: TITLE_WITH_LISTS });
  return rows.map((row) => flattenTitle(row));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

export const parseStoredKeywords = (value: unknown): TonightKeyword[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const keywords: TonightKeyword[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const id = Number(item.id);
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (Number.isInteger(id) && id > 0 && name) {
      keywords.push({ id, name });
    }
  }
  return keywords;
};

export const parseStoredPeople = (value: unknown): TonightPerson[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const people: TonightPerson[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const id = Number(item.id);
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const role = item.role;
    if (
      Number.isInteger(id) &&
      id > 0 &&
      name &&
      (role === "director" || role === "creator" || role === "cast")
    ) {
      people.push({ id, name, role });
    }
  }
  return people;
};

const queueEntryOf = (row: TitleRowWithLists): TonightQueueEntry | null => {
  const item = row.listItems.find((entry) => entry.list.slug === WATCHLIST_SLUG);
  if (!item) {
    return null;
  }
  return {
    titleId: row.id,
    position: item.position,
    addedAt: item.addedAt,
    queueNote: item.queueNote,
  };
};

export const toTonightTitle = (
  row: TitleRowWithLists,
  userPlatforms: readonly Platform[],
): TonightTitle => {
  const providers = parseStoredWatchProviders(row.watchProvidersMx);
  const availableOnMine =
    titleAvailableOnUserPlatforms(providers, userPlatforms) ||
    (!providers && row.platform != null && userPlatforms.includes(row.platform));
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    year: row.year,
    runtimeMinutes: row.runtimeMinutes,
    imdbRating: row.imdbRating,
    imdbVotes: row.imdbVotes,
    genres: parseStoredTmdbGenres(row.tmdbGenres),
    keywords: parseStoredKeywords(row.tmdbKeywords),
    people: parseStoredPeople(row.tmdbPeople),
    originalLanguage: row.originalLanguage,
    platform: row.platform,
    flatrate: providers?.flatrate ?? [],
    availableOnMine,
    watchedAt: row.watchedAt,
    rating: row.rating,
    review: row.review,
    seriesStatus: row.seriesStatus,
    seriesSeason: row.seriesSeason,
    listSlugs: row.listItems
      .filter((item) => item.list.slug !== WATCHLIST_SLUG)
      .map((item) => item.list.slug ?? item.list.id),
    availableSince: row.availableSince,
    createdAt: row.createdAt,
  };
};

/** Owned `Title` ids by film, so events filed under a catalog id reach the user's title. */
export const loadOwnedTitleIdsByCatalog = async (
  userId: string,
  catalogIds: readonly string[],
): Promise<Map<string, string>> => {
  const unique = [...new Set(catalogIds)];
  if (unique.length === 0) {
    return new Map();
  }
  const rows = await db.query.titles.findMany({
    where: and(eq(titles.userId, userId), inArray(titles.catalogId, unique)),
    columns: { id: true, catalogId: true },
  });
  return new Map(rows.map((row) => [row.catalogId, row.id]));
};

const loadEvents = async (
  userId: string,
  now: Date,
  ownedByCatalog?: ReadonlyMap<string, string>,
): Promise<TonightEvent[]> => {
  const since = new Date(now.getTime() - TONIGHT_EVENTS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db.query.pickEvents.findMany({
    where: and(eq(pickEvents.userId, userId), gte(pickEvents.createdAt, since)),
    columns: { titleId: true, catalogId: true, kind: true, createdAt: true },
  });
  const owned =
    ownedByCatalog ??
    (await loadOwnedTitleIdsByCatalog(
      userId,
      rows.flatMap((row) => (row.catalogId ? [row.catalogId] : [])),
    ));
  return toTonightEvents(rows, owned);
};

/** The title pinned for tonight right now (Buscar opens its sheet in the done state). */
export const getPinnedTonightTitleId = async (
  userId: string,
  now = new Date(),
): Promise<string | null> => {
  const since = new Date(now.getTime() - PIN_WINDOW_MS);
  const rows = await db.query.pickEvents.findMany({
    where: and(
      eq(pickEvents.userId, userId),
      gte(pickEvents.createdAt, since),
      inArray(pickEvents.kind, ["pinned", "not_tonight"]),
    ),
    columns: { titleId: true, catalogId: true, kind: true, createdAt: true },
  });
  const owned = await loadOwnedTitleIdsByCatalog(
    userId,
    rows.flatMap((row) => (row.catalogId ? [row.catalogId] : [])),
  );
  return findPinnedTitleId(toTonightEvents(rows, owned), now);
};

const loadUserPrefs = async (userId: string) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { streamingPlatforms: true, nightEndsAt: true },
  });
  return {
    userPlatforms: parseStoredStreamingPlatforms(user?.streamingPlatforms),
    nightEnds: parseNightEnds(user?.nightEndsAt),
  };
};

/** Everything the pure ranker needs, in three queries. */
export const loadTonightInput = async (
  userId: string,
  now = new Date(),
): Promise<TonightInput & { rows: TitleRowWithLists[]; nightEnds: NightEnds }> => {
  const [rows, prefs, events] = await Promise.all([
    loadTitleRows(eq(titles.userId, userId)),
    loadUserPrefs(userId),
    loadEvents(userId, now),
  ]);

  const queue = rows.flatMap((row) => {
    const entry = queueEntryOf(row);
    return entry ? [entry] : [];
  });

  return {
    titles: rows.map((row) => toTonightTitle(row, prefs.userPlatforms)),
    queue,
    events,
    userPlatforms: prefs.userPlatforms,
    nightEnds: prefs.nightEnds,
    now,
    rows,
  };
};

const persistTonight = async (userId: string, result: TonightResult) => {
  const rows = result.lenses.flatMap((lens, lensRank) =>
    lens.picks.map((pick, rank) => ({
      userId,
      titleId: pick.titleId,
      lens: lens.slug,
      lensName: lens.name,
      lensRank,
      rank,
      score: pick.baseScore,
      components: pick.components,
      reasons: pick.reasons,
      wildcard: pick.wildcard ? 1 : 0,
      computedAt: result.computedAt,
    })),
  );

  const clear = db.delete(tonightPicks).where(eq(tonightPicks.userId, userId));
  if (rows.length === 0) {
    await clear;
    return;
  }
  await db.batch([clear, db.insert(tonightPicks).values(rows)]);
};

/** Recompute and store the user's decks (cron, after writes, or lazily). */
export const computeTonightForUser = async (userId: string, now = new Date()) => {
  const input = await loadTonightInput(userId, now);
  const result = computeTonight(input);
  await persistTonight(userId, result);
  return result;
};

/** Fire-and-forget recompute once the current response is out. */
export const scheduleTonightRecompute = (userId: string) => {
  scheduleAfterResponse(async () => {
    try {
      await computeTonightForUser(userId);
    } catch {
      // Picks are a cache: the next read recomputes lazily.
    }
  });
};

export type PickEventWrite = {
  /** The user's own entry, when the feedback is about a title they have. */
  titleId?: string | null;
  /** The film; set for recommendations that are not in the library yet. */
  catalogId?: string | null;
  kind: PickEventKind;
  lens?: string | null;
};

/**
 * Store feedback by film. A `titleId` is resolved to its `catalogId` (so the event survives the
 * title and still counts for the recommendation of the same film); a bare `catalogId` must exist.
 */
export const recordPickEvents = async (userId: string, events: ReadonlyArray<PickEventWrite>) => {
  if (events.length === 0) {
    return;
  }

  const titleIds = [...new Set(events.flatMap((event) => (event.titleId ? [event.titleId] : [])))];
  const ownedRows = titleIds.length
    ? await db.query.titles.findMany({
        where: and(eq(titles.userId, userId), inArray(titles.id, titleIds)),
        columns: { id: true, catalogId: true },
      })
    : [];
  const catalogByTitle = new Map(ownedRows.map((row) => [row.id, row.catalogId]));

  const bareCatalogIds = [
    ...new Set(
      events.flatMap((event) => (!event.titleId && event.catalogId ? [event.catalogId] : [])),
    ),
  ];
  const knownCatalog = new Set(
    bareCatalogIds.length
      ? (
          await db.query.catalog.findMany({
            where: inArray(catalog.id, bareCatalogIds),
            columns: { id: true },
          })
        ).map((row) => row.id)
      : [],
  );
  const ownedByCatalog = await loadOwnedTitleIdsByCatalog(userId, bareCatalogIds);

  const now = new Date();
  const values = events.flatMap((event) => {
    if (event.titleId) {
      const catalogId = catalogByTitle.get(event.titleId);
      // Not the user's title: drop it rather than file feedback under someone else's id.
      return catalogId
        ? [{ titleId: event.titleId, catalogId, kind: event.kind, lens: event.lens ?? null }]
        : [];
    }
    if (event.catalogId && knownCatalog.has(event.catalogId)) {
      return [
        {
          titleId: ownedByCatalog.get(event.catalogId) ?? null,
          catalogId: event.catalogId,
          kind: event.kind,
          lens: event.lens ?? null,
        },
      ];
    }
    return [];
  });
  if (values.length === 0) {
    return;
  }

  await db.insert(pickEvents).values(
    values.map((value) => ({ id: createId(), userId, ...value, createdAt: now })),
  );
};

const toCard = (
  row: TitleRowWithLists,
  pick: TonightPickBase,
  userPlatforms: readonly Platform[],
  pinned = false,
): TonightCard => ({
  ...toCoverflowTitle(row, userPlatforms),
  runtimeMinutes: row.runtimeMinutes,
  components: pick.components,
  reasons: pick.reasons,
  wildcard: pick.wildcard,
  pinned,
  posterAmbient: row.posterAmbient,
  queueNote: queueEntryOf(row)?.queueNote ?? null,
  overview: row.overview,
  leads: parseStoredPeople(row.tmdbPeople).filter((person) => person.role !== "cast"),
  source: "queue",
  reco: null,
});

/**
 * Put the pinned title first in Para ti (creating the lens if needed). It skips
 * `isTonightCandidate` on purpose: the user chose it, available on their platforms or not.
 */
const applyPinnedCard = (
  lenses: TonightLensView[],
  row: TitleRowWithLists | undefined,
  pick: TonightPickBase | null,
  userPlatforms: readonly Platform[],
): TonightLensView[] => {
  if (!row || row.watchedAt || !queueEntryOf(row)) {
    return lenses;
  }
  const base: TonightPickBase = pick ?? {
    titleId: row.id,
    components: parseComponents({}),
    baseScore: 0,
    reasons: [],
    wildcard: false,
  };
  const card = toCard(
    row,
    { ...base, wildcard: false, reasons: [PINNED_REASON, ...base.reasons.filter((r) => r.kind !== "pinned")] },
    userPlatforms,
    true,
  );
  const paraTi = lenses.find((lens) => lens.kind === "para-ti");
  if (!paraTi) {
    return [{ slug: PARA_TI_SLUG, name: PARA_TI_NAME, kind: "para-ti", titles: [card] }, ...lenses];
  }
  return lenses.map((lens) =>
    lens === paraTi
      ? { ...lens, titles: [card, ...lens.titles.filter((title) => title.id !== card.id)] }
      : lens,
  );
};

/** The pool older than this is a night that never ran: better the queue alone than stale taste. */
export const RECO_STALE_MS = 7 * 24 * 60 * 60 * 1000;

const catalogToTonightTitle = (row: CatalogRow): TonightTitle => {
  const providers = parseStoredWatchProviders(row.watchProvidersMx);
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    year: row.year,
    runtimeMinutes: row.runtimeMinutes,
    imdbRating: row.imdbRating,
    imdbVotes: row.imdbVotes,
    genres: parseStoredTmdbGenres(row.tmdbGenres),
    keywords: parseStoredKeywords(row.tmdbKeywords),
    people: parseStoredPeople(row.tmdbPeople),
    originalLanguage: row.originalLanguage,
    platform: null,
    flatrate: providers?.flatrate ?? [],
    availableOnMine: true,
    watchedAt: null,
    rating: null,
    review: null,
    seriesStatus: null,
    seriesSeason: null,
    listSlugs: [],
    availableSince: row.availableSince,
    createdAt: row.createdAt,
  };
};

/**
 * The user's recommended pool as cards, ready to compose into the lenses. Database only (the
 * nightly cron did the TMDB work). Films the user has added since, «Ahora no» and «Menos así»
 * are dropped, and so is a pool nobody has refreshed for a week.
 */
export const loadRecoEntries = async (
  userId: string,
  userPlatforms: readonly Platform[],
  events: readonly TonightEvent[],
  now: Date,
): Promise<RecoEntry<TonightCard>[]> => {
  const rows = await db
    .select({ reco: tonightRecos, catalog })
    .from(tonightRecos)
    .innerJoin(catalog, eq(tonightRecos.catalogId, catalog.id))
    .where(
      and(
        eq(tonightRecos.userId, userId),
        gte(tonightRecos.computedAt, new Date(now.getTime() - RECO_STALE_MS)),
      ),
    )
    .orderBy(asc(tonightRecos.rank));
  if (rows.length === 0) {
    return [];
  }

  const owned = await loadOwnedTitleIdsByCatalog(
    userId,
    rows.map((row) => row.catalog.id),
  );
  const blocked = blockedItemIds(events, now);

  return rows.flatMap(({ reco, catalog: film }) => {
    if (owned.has(film.id) || blocked.has(film.id)) {
      return [];
    }
    const title = catalogToTonightTitle(film);
    const components = parseComponents(reco.components);
    const reasons = parseReasons(reco.reasons);
    const sourceKind: "recommendations" | "discover" =
      reco.sourceKind === "discover" ? "discover" : "recommendations";
    const card: TonightCard = {
      ...toCoverflowTitle(
        {
          id: film.id,
          name: film.name,
          kind: film.kind,
          year: film.year,
          rating: null,
          posterPath: film.posterPath,
          platform: null,
          imdbRating: film.imdbRating,
          watchedAt: null,
          review: null,
          seriesStatus: null,
          watchProvidersMx: film.watchProvidersMx,
          tmdbGenres: film.tmdbGenres,
        },
        userPlatforms,
      ),
      runtimeMinutes: film.runtimeMinutes,
      components,
      reasons,
      wildcard: false,
      pinned: false,
      posterAmbient: film.posterAmbient,
      queueNote: null,
      overview: film.overview,
      leads: parseStoredPeople(film.tmdbPeople).filter((person) => person.role !== "cast"),
      source: "reco",
      reco: { tmdbId: film.tmdbId, seedName: reco.seedName, sourceKind },
    };
    return [
      {
        card,
        scored: {
          title,
          vector: itemVector(title),
          pick: {
            titleId: film.id,
            components,
            baseScore: reco.score,
            reasons,
            wildcard: false,
          },
        },
      },
    ];
  });
};

const lensesFromResult = (
  result: TonightResult,
  rowsById: ReadonlyMap<string, TitleRowWithLists>,
  userPlatforms: readonly Platform[],
): TonightLensView[] =>
  result.lenses
    .map((lens) => ({
      slug: lens.slug,
      name: lens.name,
      kind: lens.kind,
      titles: lens.picks.flatMap((pick) => {
        const row = rowsById.get(pick.titleId);
        return row ? [toCard(row, pick, userPlatforms)] : [];
      }),
    }))
    .filter((lens) => lens.titles.length > 0);

export const parseComponents = (value: unknown): TonightComponents => {
  const record = isRecord(value) ? value : {};
  const num = (key: keyof TonightComponents, fallback: number) => {
    const raw = Number(record[key]);
    return Number.isFinite(raw) ? raw : fallback;
  };
  return {
    gusto: num("gusto", 0.5),
    calidad: num("calidad", 0.45),
    impulso: num("impulso", 0),
    novedad: num("novedad", 0),
    reposo: num("reposo", 0),
    fatiga: num("fatiga", 1),
  };
};

export const parseReasons = (value: unknown): TonightReason[] =>
  Array.isArray(value)
    ? value.flatMap((item) =>
        isRecord(item) && typeof item.text === "string" && typeof item.kind === "string"
          ? [
              {
                kind: item.kind as TonightReason["kind"],
                text: item.text,
                detail: typeof item.detail === "string" ? item.detail : undefined,
                weight: Number(item.weight) || 0,
                personal: Boolean(item.personal),
                ...(Number.isInteger(item.personId) ? { personId: Number(item.personId) } : {}),
              },
            ]
          : [],
      )
    : [];

/**
 * Read the precomputed decks for the user. Stale or missing → compute now
 * (≈50–150 ms) and persist after the response. Fit with the clock is applied
 * on the client, where the local time lives.
 */
export const getTonightDecks = async (
  userId: string,
  now = new Date(),
): Promise<TonightDecks> => {
  const picks = await db.query.tonightPicks.findMany({
    where: eq(tonightPicks.userId, userId),
    orderBy: [asc(tonightPicks.lensRank), asc(tonightPicks.rank)],
  });

  const newest = picks[0]?.computedAt;
  const stale = !newest || now.getTime() - newest.getTime() > TONIGHT_STALE_MS;

  if (stale) {
    const input = await loadTonightInput(userId, now);
    const result = computeTonight(input);
    scheduleAfterResponse(async () => {
      try {
        await persistTonight(userId, result);
      } catch {
        // Best effort; the next read recomputes again.
      }
    });
    // Posters / genres / providers for queued titles keep filling in off the request path.
    const queuedIds = new Set(input.queue.map((entry) => entry.titleId));
    scheduleDiaryWatchlistEnrichment(
      input.rows.filter((row) => queuedIds.has(row.id) && row.watchedAt == null),
    );
    const rowsById = new Map(input.rows.map((row) => [row.id, row]));
    const freshPinnedId = findPinnedTitleId(input.events, now);
    const freshLenses = lensesFromResult(result, rowsById, input.userPlatforms);
    const freshRecos = await loadRecoEntries(userId, input.userPlatforms, input.events, now);
    const queueLenses = freshPinnedId
      ? applyPinnedCard(
          freshLenses,
          rowsById.get(freshPinnedId),
          result.lenses.flatMap((lens) => lens.picks).find((pick) => pick.titleId === freshPinnedId) ??
            null,
          input.userPlatforms,
        )
      : freshLenses;
    return {
      lenses: composeLenses(queueLenses, freshRecos),
      nightEnds: input.nightEnds,
      userPlatforms: input.userPlatforms,
      profileSize: result.profileSize,
      computedAt: result.computedAt.toISOString(),
      queueSize: input.queue.length,
    };
  }

  const [prefs, events, queueCount] = await Promise.all([
    loadUserPrefs(userId),
    loadEvents(userId, now),
    countQueue(userId),
  ]);
  const pinnedId = findPinnedTitleId(events, now);
  const titleIds = [...new Set([...picks.map((pick) => pick.titleId), ...(pinnedId ? [pinnedId] : [])])];
  const rows =
    titleIds.length > 0
      ? await loadTitleRows(and(eq(titles.userId, userId), inArray(titles.id, titleIds)))
      : [];

  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const excluded = new Set(
    events
      .filter(
        (event) =>
          event.kind === "not_tonight" &&
          now.getTime() - event.createdAt.getTime() < 14 * 24 * 60 * 60 * 1000,
      )
      .map((event) => event.titleId),
  );

  const lensesByslug = new Map<string, TonightLensView>();
  for (const pick of picks) {
    const row = rowsById.get(pick.titleId);
    if (!row || row.watchedAt || !queueEntryOf(row) || excluded.has(pick.titleId)) {
      continue;
    }
    const lens = lensesByslug.get(pick.lens) ?? {
      slug: pick.lens,
      name: pick.lensName,
      kind: (pick.lens === "para-ti" ? "para-ti" : "genre") as TonightLensKind,
      titles: [],
    };
    lens.titles.push(
      toCard(
        row,
        {
          titleId: pick.titleId,
          components: parseComponents(pick.components),
          baseScore: pick.score,
          reasons: parseReasons(pick.reasons),
          wildcard: pick.wildcard === 1,
        },
        prefs.userPlatforms,
      ),
    );
    lensesByslug.set(pick.lens, lens);
  }

  const lenses = [...lensesByslug.values()].filter((lens) => lens.titles.length > 0);
  if (lenses.length === 0 && picks.length > 0) {
    // Everything we had stored is gone (watched / dequeued): rebuild now.
    scheduleTonightRecompute(userId);
  }

  const pinnedPick = pinnedId
    ? (picks.find((pick) => pick.titleId === pinnedId && pick.lens === PARA_TI_SLUG) ??
      picks.find((pick) => pick.titleId === pinnedId))
    : undefined;

  const queueLenses = pinnedId
    ? applyPinnedCard(
        lenses,
        rowsById.get(pinnedId),
        pinnedPick
          ? {
              titleId: pinnedPick.titleId,
              components: parseComponents(pinnedPick.components),
              baseScore: pinnedPick.score,
              reasons: parseReasons(pinnedPick.reasons),
              wildcard: pinnedPick.wildcard === 1,
            }
          : null,
        prefs.userPlatforms,
      )
    : lenses;
  const recos = await loadRecoEntries(userId, prefs.userPlatforms, events, now);

  return {
    lenses: composeLenses(queueLenses, recos),
    nightEnds: prefs.nightEnds,
    userPlatforms: prefs.userPlatforms,
    profileSize: 0,
    computedAt: newest ? newest.toISOString() : now.toISOString(),
    queueSize: queueCount,
  };
};

const countQueue = async (userId: string) => {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listItems)
    .innerJoin(lists, eq(listItems.listId, lists.id))
    .where(and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)));
  return rows[0]?.count ?? 0;
};
