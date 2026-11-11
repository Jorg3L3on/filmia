import type { Platform, TitleKind } from "@/db";
import { PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import { officialWeekLabel } from "@/lib/netflix-top10";

/**
 * Hoy's second act (FIL-I47): «Lo más popular en <servicio>» and «Recién llegó». Pure rules,
 * safe for the client; the cron and the reads live in `service-charts-store`.
 */

export const CHART_SIZE = 10;

/** `popularity` = TMDB discover order (never called «Top 10»); `official` = the service's own list. */
export type ServiceChartSource = "popularity" | "official";

export const SERVICE_CHART_SOURCES: readonly ServiceChartSource[] = ["popularity", "official"];

export const parseChartSource = (value: unknown): ServiceChartSource =>
  value === "official" ? "official" : "popularity";

/** Films first (Jorge, 2026-11-10). */
export const CHART_KINDS: readonly TitleKind[] = ["MOVIE", "SERIES"];

export const CHART_KIND_LABEL: Record<TitleKind, string> = { MOVIE: "Películas", SERIES: "Series" };

/** The section heading. Popularity lists must never say «Top 10». */
export const chartHeading = (platform: Platform, source: ServiceChartSource) =>
  source === "official" ? "Top 10 en México" : `Lo más popular en ${PLATFORM_SERVICE_LABEL[platform]}`;

/** The line under the heading: where the order comes from (and, official, which week). */
export const chartSourceLine = (platform: Platform, source: ServiceChartSource, period?: string) =>
  source === "official"
    ? `Lista oficial de ${PLATFORM_SERVICE_LABEL[platform]}${period ? ` · ${officialWeekLabel(period)}` : ""}`
    : `Incluido en ${PLATFORM_SERVICE_LABEL[platform]} en México · por popularidad en TMDB`;

export type RankMovement = { kind: "up" | "down" | "same" | "new"; by: number };

/** ▲ / ▼ / ＝ against the previous snapshot; NUEVO when the title was not on it. */
export const rankMovement = (rank: number, previousRank: number | null): RankMovement => {
  if (previousRank == null) return { kind: "new", by: 0 };
  if (previousRank > rank) return { kind: "up", by: previousRank - rank };
  if (previousRank < rank) return { kind: "down", by: rank - previousRank };
  return { kind: "same", by: 0 };
};

/**
 * Chips only when there is something to compare with: a first snapshot (or the first official
 * week after popularity) would say NUEVO on every poster.
 */
export const showsMovement = (titles: readonly Pick<ChartTitle, "previousRank">[]) =>
  titles.some((title) => title.previousRank != null);

/** «3 semanas en el Top 10». */
export const weeksOnListLabel = (weeks: number | null) =>
  weeks == null ? null : weeks === 1 ? "1.ª semana" : `${weeks} semanas`;

/**
 * Each service's light: the outlined numerals and the section glow take it. Space-separated RGB
 * like `--que-ver-glow`, picked to read on the dark canvas (not the brands' exact hex).
 */
export const SERVICE_TINT: Record<Platform, string> = {
  NETFLIX: "229 9 20",
  PRIME: "0 168 225",
  DISNEY: "64 132 255",
  MAX: "112 84 255",
  APPLE: "200 204 210",
  PARAMOUNT: "0 100 255",
  CRUNCHYROLL: "244 117 33",
  VIX: "255 102 0",
  CLARO: "220 30 40",
  MUBI: "90 120 255",
  PLUTO: "255 230 0",
  AMCPLUS: "190 190 190",
  CURIOSITY: "40 170 220",
  LIONSGATE: "210 170 90",
};

/** One discover result the cron keeps, already resolved to its Catalog row. */
export type ChartEntry = { catalogId: string };

export type ChartSnapshotRow = {
  rank: number;
  catalogId: string;
  previousRank: number | null;
};

/**
 * The rows to store for one platform and kind: the first `CHART_SIZE` distinct titles in order,
 * each with its rank in the snapshot being replaced (null when it is new on the list).
 */
export const snapshotRows = (
  entries: readonly ChartEntry[],
  previous: ReadonlyMap<string, number>,
  size = CHART_SIZE,
): ChartSnapshotRow[] => {
  const rows: ChartSnapshotRow[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (rows.length >= size) break;
    if (seen.has(entry.catalogId)) continue;
    seen.add(entry.catalogId);
    rows.push({ rank: rows.length + 1, catalogId: entry.catalogId, previousRank: previous.get(entry.catalogId) ?? null });
  }
  return rows;
};

/** A title on a ranked rail. */
export type ChartTitle = {
  catalogId: string;
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName: string | null;
  year: number | null;
  posterPath: string | null;
  rank: number;
  previousRank: number | null;
  weeksOnList: number | null;
};

export type ServiceChart = {
  platform: Platform;
  kind: TitleKind;
  source: ServiceChartSource;
  /** YYYY-MM-DD. */
  period: string;
  titles: ChartTitle[];
};

/**
 * The switcher: the user's platforms that have a list, in the user's order. A platform with
 * only series still shows (the kind switch then opens on Series).
 */
export const chartPlatformsFor = (
  userPlatforms: readonly Platform[],
  charts: readonly Pick<ServiceChart, "platform" | "titles">[],
): Platform[] => {
  const withTitles = new Set(charts.filter((chart) => chart.titles.length > 0).map((chart) => chart.platform));
  return userPlatforms.filter((platform) => withTitles.has(platform));
};

/** The kind a platform opens on: films unless it has none. */
export const defaultChartKind = (
  platform: Platform,
  charts: readonly Pick<ServiceChart, "platform" | "kind" | "titles">[],
): TitleKind => {
  const hasMovies = charts.some((chart) => chart.platform === platform && chart.kind === "MOVIE" && chart.titles.length > 0);
  return hasMovies ? "MOVIE" : "SERIES";
};

/** «Recién llegó» looks back this far. */
export const ARRIVALS_WINDOW_DAYS = 7;

export const ARRIVALS_LIMIT = 12;

export type ArrivalTitle = {
  catalogId: string;
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName: string | null;
  year: number | null;
  posterPath: string | null;
  platform: Platform;
  /** ISO timestamp of `Catalog.availableSince`. */
  availableSince: string;
};

export type ArrivalDay = {
  /** YYYY-MM-DD in Mexico City. */
  day: string;
  /** «HOY», «AYER» or the weekday, short and upper case («JUE»). */
  label: string;
  /** Day of the month, for the big numeral. */
  dayOfMonth: number;
  titles: ArrivalTitle[];
};

const MX_TIME_ZONE = "America/Mexico_City";

const mxDay = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: MX_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

const WEEKDAY = new Intl.DateTimeFormat("es-MX", { timeZone: MX_TIME_ZONE, weekday: "short" });

const dayBefore = (day: string) =>
  new Date(Date.parse(`${day}T12:00:00Z`) - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Newest first, grouped by Mexico City day. */
export const groupArrivalsByDay = (titles: readonly ArrivalTitle[], now: Date): ArrivalDay[] => {
  const today = mxDay(now);
  const yesterday = dayBefore(today);
  const sorted = [...titles].sort((a, b) => Date.parse(b.availableSince) - Date.parse(a.availableSince));
  const days: ArrivalDay[] = [];
  for (const title of sorted) {
    const at = new Date(title.availableSince);
    const day = mxDay(at);
    let group = days.at(-1);
    if (!group || group.day !== day) {
      const label =
        day === today
          ? "HOY"
          : day === yesterday
            ? "AYER"
            : WEEKDAY.format(at).replace(".", "").toUpperCase();
      group = { day, label, dayOfMonth: Number(day.slice(8, 10)), titles: [] };
      days.push(group);
    }
    group.titles.push(title);
  }
  return days;
};

/**
 * What the Hoy tab dot compares (FIL-I47-2): the top three of each list the user can see and the
 * newest arrival. Popularity shuffles below the top three do not light the dot.
 */
export const actTwoStamp = (
  charts: readonly Pick<ServiceChart, "platform" | "kind" | "titles">[],
  arrivals: readonly Pick<ArrivalTitle, "catalogId">[],
) => {
  const parts = [...charts]
    .sort((a, b) => `${a.platform}:${a.kind}`.localeCompare(`${b.platform}:${b.kind}`))
    .map((chart) => `${chart.platform}:${chart.kind}:${chart.titles.slice(0, 3).map((title) => title.catalogId).join(",")}`);
  parts.push(`arrival:${arrivals[0]?.catalogId ?? ""}`);
  // FNV-1a: short, stable, no crypto needed in the browser.
  let hash = 0x811c9dc5;
  for (const char of parts.join("|")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
};

/** localStorage key: the stamp of the act two the user last saw on Hoy. */
export const ACT_TWO_SEEN_KEY = "filmia:hoy-acto-dos";

/** Window event Hoy fires after it stores a new stamp, so the dock clears its dot at once. */
export const ACT_TWO_SEEN_EVENT = "filmia:hoy-acto-dos-visto";

/* ---------------------------------------------------------------------------------------------
 * FIL-I47-4: «Joyas que ya pagas», «Porque te gustó» and the order of the sections.
 * ------------------------------------------------------------------------------------------- */

export const GEMS_LIMIT = 8;

export type GemCandidate = {
  catalogId: string;
  imdbRating: number | null;
  imdbVotes: number | null;
  rtScore: number | null;
  metascore: number | null;
  backdropPath: string | null;
};

/** A critic gem: IMDb ≥ 7.8, or Rotten Tomatoes ≥ 90, or Metacritic ≥ 80. */
export const isGem = (title: Pick<GemCandidate, "imdbRating" | "rtScore" | "metascore">) =>
  (title.imdbRating ?? 0) >= 7.8 || (title.rtScore ?? 0) >= 90 || (title.metascore ?? 0) >= 80;

/** Strength of the proof, for the order: each score on a 0–1 scale, the best of them, then votes. */
const gemStrength = (title: GemCandidate) =>
  Math.max(
    title.imdbRating != null ? (title.imdbRating - 7) / 3 : 0,
    title.rtScore != null ? (title.rtScore - 80) / 20 : 0,
    title.metascore != null ? (title.metascore - 70) / 30 : 0,
  );

/**
 * The gems to show: proven by the critics, with a still to show (wide cards), outside every
 * current chart (those are already on the page) and not watched by the user. Strongest first.
 */
export const pickGems = <T extends GemCandidate>(
  candidates: readonly T[],
  exclude: ReadonlySet<string>,
  limit = GEMS_LIMIT,
): T[] =>
  candidates
    .filter((title) => isGem(title) && Boolean(title.backdropPath) && !exclude.has(title.catalogId))
    .sort((a, b) => gemStrength(b) - gemStrength(a) || (b.imdbVotes ?? 0) - (a.imdbVotes ?? 0) || a.catalogId.localeCompare(b.catalogId))
    .slice(0, limit);

export const SEED_RAIL_MIN = 3;
export const SEED_RAIL_LIMIT = 8;

export type SeededReco = { catalogId: string; seedCatalogId: string | null; seedName: string | null; rank: number };

/**
 * «Porque te gustó X»: the seed that led to the most recommendations (ties: the best-ranked one),
 * with its recommendations in rank order. Null under three, so the rail never looks empty.
 */
export const pickSeedRail = <T extends SeededReco>(recos: readonly T[]) => {
  const bySeed = new Map<string, T[]>();
  for (const reco of recos) {
    if (!reco.seedCatalogId || !reco.seedName) continue;
    const list = bySeed.get(reco.seedCatalogId) ?? [];
    list.push(reco);
    bySeed.set(reco.seedCatalogId, list);
  }
  let best: { seedCatalogId: string; seedName: string; titles: T[] } | null = null;
  for (const [seedCatalogId, list] of bySeed) {
    const sorted = [...list].sort((a, b) => a.rank - b.rank);
    const better =
      !best ||
      sorted.length > best.titles.length ||
      (sorted.length === best.titles.length && (sorted[0]?.rank ?? Infinity) < (best.titles[0]?.rank ?? Infinity));
    if (better) best = { seedCatalogId, seedName: sorted[0]!.seedName!, titles: sorted };
  }
  if (!best || best.titles.length < SEED_RAIL_MIN) return null;
  return { ...best, titles: best.titles.slice(0, SEED_RAIL_LIMIT) };
};

export type ActTwoSection = "ranking" | "afina" | "arrivals" | "gems" | "seed";

/**
 * The page ordered by how much Hoy knows (signals, see `countSignals`): a new account starts with
 * the ranking and the taste card; a light one sees its own taste second; a rich one opens on what
 * just arrived and never sees «Afina tu gusto».
 */
export const actTwoOrder = (signals: number): ActTwoSection[] =>
  signals < 10
    ? ["ranking", "afina", "arrivals", "gems", "seed"]
    : signals <= 40
      ? ["ranking", "seed", "arrivals", "afina", "gems"]
      : ["arrivals", "seed", "ranking", "gems"];

/** Room (px) the peek's full line needs between the sala and the dock; under it, the chevron alone. */
export const PEEK_FULL_ROOM = 20;
/** Under this there is no room at all: nothing shows, and the act is found by scrolling. */
export const PEEK_CHEVRON_ROOM = 9;

export type PeekFit = { mode: "full" | "chevron" | "none"; top: number };

/**
 * Where Hoy's peek line goes (FIL-I47-1): centred in the gap between the bottom of the sala and the
 * top of the dock (the viewport's bottom on desktop), so the night line's labels are never covered.
 * iOS Safari's safe area leaves ~12 px on an iPhone: only the chevron fits there.
 */
export const fitPeek = (salaBottom: number, dockTop: number, fullHeight = 18, chevronHeight = 10): PeekFit => {
  const room = dockTop - salaBottom;
  if (room >= PEEK_FULL_ROOM) return { mode: "full", top: salaBottom + (room - fullHeight) / 2 };
  if (room >= PEEK_CHEVRON_ROOM) return { mode: "chevron", top: salaBottom + (room - chevronHeight) / 2 };
  return { mode: "none", top: 0 };
};

/* FIL-I47-6 · «Asomo»: where there is no room for the peek line (iPhone Safari), the first visits
 * get one small bounce that shows the second act's edge. */

/** localStorage key: `{ bounces, seen }` for this device. */
export const ASOMO_KEY = "filmia:hoy-asomo";
export const ASOMO_MAX_BOUNCES = 3;
/** How long Hoy waits, untouched, before bouncing. */
export const ASOMO_DELAY_MS = 2500;
/** What of the act two shows above the dock during the dip: its handle and the date line. */
export const ASOMO_REVEAL_PX = 44;

/**
 * How far the page dips (pure, tested): everything the dock and browser bars cover at the bottom,
 * plus the part of the act two to show. iOS Safari's floating toolbar sits under the dock, so on an
 * iPhone this is ~200 px; on a phone browser without it, ~120 px.
 */
export const asomoDistance = (viewportHeight: number, dockTop: number) =>
  Math.round(Math.max(0, viewportHeight - dockTop) + ASOMO_REVEAL_PX);

export type AsomoState = { bounces: number; seen: boolean };

export const parseAsomo = (raw: string | null): AsomoState => {
  try {
    const value = raw ? (JSON.parse(raw) as Partial<AsomoState>) : {};
    return {
      bounces: Number.isInteger(value.bounces) && (value.bounces as number) > 0 ? (value.bounces as number) : 0,
      seen: value.seen === true,
    };
  } catch {
    return { bounces: 0, seen: false };
  }
};

/**
 * Bounce only for someone who has not reached the second act yet, on their first visits, with the
 * act still below the fold, untouched since load, never with reduced motion or in lite sala.
 */
export const shouldBounce = (input: {
  state: AsomoState;
  reducedMotion: boolean;
  lite: boolean;
  actBelowFold: boolean;
  touched: boolean;
}) =>
  !input.reducedMotion &&
  !input.lite &&
  input.actBelowFold &&
  !input.touched &&
  !input.state.seen &&
  input.state.bounces < ASOMO_MAX_BOUNCES;
