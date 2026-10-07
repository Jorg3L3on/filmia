import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  db,
  listItems,
  lists,
  pickEvents,
  titles,
  tonightPicks,
  users,
  type Platform,
  type Title,
} from "@/db";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { scheduleAfterResponse } from "@/lib/after-response";
import { toCoverflowTitle } from "@/lib/coverflow-title";
import { scheduleDiaryWatchlistEnrichment } from "@/lib/diary-enrich";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { WATCHLIST_SLUG } from "@/lib/lists";
import { PARA_TI_NAME, PARA_TI_SLUG } from "@/lib/tonight/select";
import { findPinnedTitleId, PINNED_REASON } from "@/lib/tonight/pin";
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

export const PICK_EVENT_KINDS: readonly PickEventKind[] = [
  "shown",
  "skipped",
  "not_tonight",
  "opened",
  "watched",
  "more_like",
  "less_like",
  "pinned",
];

export const isPickEventKind = (value: unknown): value is PickEventKind =>
  typeof value === "string" && (PICK_EVENT_KINDS as readonly string[]).includes(value);

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
  listItems: {
    with: { list: { columns: { id: true, slug: true } } },
  },
} as const;

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

const loadEvents = async (userId: string, now: Date): Promise<TonightEvent[]> => {
  const since = new Date(now.getTime() - TONIGHT_EVENTS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db.query.pickEvents.findMany({
    where: and(eq(pickEvents.userId, userId), gte(pickEvents.createdAt, since)),
    columns: { titleId: true, kind: true, createdAt: true },
  });
  return rows.flatMap((row) =>
    isPickEventKind(row.kind)
      ? [{ titleId: row.titleId, kind: row.kind, createdAt: row.createdAt }]
      : [],
  );
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
    db.query.titles.findMany({
      where: eq(titles.userId, userId),
      with: TITLE_WITH_LISTS,
    }) as Promise<TitleRowWithLists[]>,
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

export const recordPickEvents = async (
  userId: string,
  events: ReadonlyArray<{ titleId: string; kind: PickEventKind; lens?: string | null }>,
) => {
  if (events.length === 0) {
    return;
  }
  const now = new Date();
  await db.insert(pickEvents).values(
    events.map((event) => ({
      id: createId(),
      userId,
      titleId: event.titleId,
      kind: event.kind,
      lens: event.lens ?? null,
      createdAt: now,
    })),
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
    return {
      lenses: freshPinnedId
        ? applyPinnedCard(
            freshLenses,
            rowsById.get(freshPinnedId),
            result.lenses.flatMap((lens) => lens.picks).find((pick) => pick.titleId === freshPinnedId) ??
              null,
            input.userPlatforms,
          )
        : freshLenses,
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
  const rows = (
    titleIds.length > 0
      ? await db.query.titles.findMany({
          where: and(eq(titles.userId, userId), inArray(titles.id, titleIds)),
          with: TITLE_WITH_LISTS,
        })
      : []
  ) as TitleRowWithLists[];

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

  return {
    lenses: pinnedId
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
      : lenses,
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
