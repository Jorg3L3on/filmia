import type { TitleKind } from "@/db";

/**
 * A ficha preview (FIL-I8) that just created the user's Title tells the page
 * they came from. Hoy's recommended cards live in client state, so on Back
 * the card reads this and says «Ya está en Quiero ver» (or leaves, if seen).
 * Per tab (sessionStorage), keyed by the film, kept for an hour.
 */
export const FICHA_HANDOFF_KEY = "filmia.ficha-handoff";
const HANDOFF_TTL_MS = 60 * 60 * 1000;
const HANDOFF_LIMIT = 24;

export type FichaHandoff = {
  titleId: string;
  inWatchlist: boolean;
  watched: boolean;
  at: number;
};

type HandoffStorage = Pick<Storage, "getItem" | "setItem">;

export const handoffKey = (kind: TitleKind, tmdbId: number) => `${kind}:${tmdbId}`;

const isHandoff = (value: unknown): value is FichaHandoff => {
  const entry = value as FichaHandoff;
  return (
    typeof entry?.titleId === "string" &&
    typeof entry.inWatchlist === "boolean" &&
    typeof entry.watched === "boolean" &&
    typeof entry.at === "number"
  );
};

export const parseHandoffs = (raw: string | null, now = Date.now()): Record<string, FichaHandoff> => {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed ?? {}).filter(
        (entry): entry is [string, FichaHandoff] => isHandoff(entry[1]) && now - entry[1].at < HANDOFF_TTL_MS,
      ),
    );
  } catch {
    return {};
  }
};

/** Merge what this ficha learned; an earlier «En Quiero ver» or «vista» is never forgotten. */
export const withHandoff = (
  handoffs: Record<string, FichaHandoff>,
  key: string,
  entry: Omit<FichaHandoff, "at">,
  now = Date.now(),
): Record<string, FichaHandoff> => {
  const previous = handoffs[key];
  const next = {
    ...handoffs,
    [key]: {
      titleId: entry.titleId,
      inWatchlist: entry.inWatchlist || Boolean(previous?.inWatchlist),
      watched: entry.watched || Boolean(previous?.watched),
      at: now,
    },
  };
  const newest = Object.entries(next)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, HANDOFF_LIMIT);
  return Object.fromEntries(newest);
};

const sessionStore = (): HandoffStorage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const writeFichaHandoff = (key: string, entry: Omit<FichaHandoff, "at">, storage = sessionStore()) => {
  if (!storage) {
    return;
  }
  try {
    const next = withHandoff(parseHandoffs(storage.getItem(FICHA_HANDOFF_KEY)), key, entry);
    storage.setItem(FICHA_HANDOFF_KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota: Hoy simply learns it on its next load.
  }
};

export const readFichaHandoffs = (storage = sessionStore()) => {
  try {
    return storage ? parseHandoffs(storage.getItem(FICHA_HANDOFF_KEY)) : {};
  } catch {
    return {};
  }
};
