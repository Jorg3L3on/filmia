import type { Platform, SeriesStatus, TitleKind } from "@/db";
import type { WatchProviderOffer } from "@/lib/watch-providers";

export type TonightGenre = { id: number; name: string };
export type TonightKeyword = { id: number; name: string };
export type TonightPersonRole = "director" | "creator" | "cast";
export type TonightPerson = { id: number; name: string; role: TonightPersonRole };

/** One of the user's titles (watched or queued) as the ranker sees it. */
export type TonightTitle = {
  id: string;
  name: string;
  kind: TitleKind;
  year: number | null;
  runtimeMinutes: number | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  genres: TonightGenre[];
  keywords: TonightKeyword[];
  people: TonightPerson[];
  originalLanguage: string | null;
  platform: Platform | null;
  flatrate: WatchProviderOffer[];
  /** Flatrate on one of the user's platforms (resolved by the loader). */
  availableOnMine: boolean;
  watchedAt: Date | null;
  rating: number | null;
  review: string | null;
  seriesStatus: SeriesStatus | null;
  seriesSeason: number | null;
  /** Slugs of fixed lists the title belongs to (favoritas, por-rewatch) + custom list ids. */
  listSlugs: string[];
  availableSince: Date | null;
  createdAt: Date;
};

export type TonightQueueEntry = {
  titleId: string;
  position: number;
  addedAt: Date;
  queueNote: string | null;
};

export type PickEventKind =
  | "shown"
  | "skipped"
  | "not_tonight"
  | "opened"
  | "watched"
  | "more_like"
  | "less_like"
  /** «Esta noche» from Quiero ver: force this title to the front of Para ti tonight. */
  | "pinned";

export type TonightEvent = {
  titleId: string;
  kind: PickEventKind;
  createdAt: Date;
};

/** When the night ends, `HH:MM` local. Weekend = Friday and Saturday nights. */
export type NightEnds = {
  weekday: string;
  weekend: string;
};

export type TonightInput = {
  titles: TonightTitle[];
  queue: TonightQueueEntry[];
  events: TonightEvent[];
  userPlatforms: Platform[];
  nightEnds: NightEnds;
  now: Date;
};

export type ReasonKind =
  | "taste_anchor"
  | "taste_person"
  | "quality"
  | "fit"
  | "fit_over"
  | "series"
  | "rewatch"
  | "note"
  | "position"
  | "fresh_platform"
  | "fresh_added"
  | "aging"
  | "wildcard"
  | "pinned"
  /** Recommended, not in your library: «Porque tienes X en Quiero ver» / «Porque le diste 5★ a X». */
  | "reco_seed"
  /** Recommended by genre: no seed, just the genres you keep coming back to. */
  | "reco_genre";

export type TonightReason = {
  kind: ReasonKind;
  text: string;
  detail?: string;
  /** Contribution to the score; higher = shown first. */
  weight: number;
  /** Personal (about you) vs objective (about the title). */
  personal: boolean;
  /** `taste_person`: TMDB id of that director / creator (links to their filmography). */
  personId?: number;
};

export type TonightComponents = {
  gusto: number;
  calidad: number;
  impulso: number;
  novedad: number;
  reposo: number;
  fatiga: number;
};

export type TonightPickBase = {
  titleId: string;
  components: TonightComponents;
  /** Score without the clock (fit uses a typical 3 h evening). */
  baseScore: number;
  reasons: TonightReason[];
  wildcard: boolean;
};

export type TonightLensKind = "para-ti" | "genre";

export type TonightLens = {
  slug: string;
  name: string;
  kind: TonightLensKind;
  genreId: number | null;
  picks: TonightPickBase[];
};

export type TonightResult = {
  lenses: TonightLens[];
  /** Watched + rated titles that fed the taste profile. */
  profileSize: number;
  computedAt: Date;
};

export type TonightFit = {
  fit: number;
  endsAt: string;
  overflowMinutes: number;
  remainingMinutes: number;
};

/** Where a recommendation came from. */
export type RecoSourceKind = "recommendations" | "discover";

/** A film of the user's library that led to a recommendation. */
export type RecoSeed = {
  /** The user's `Title` id (the engine's id for it). */
  titleId: string;
  catalogId: string;
  tmdbId: number;
  kind: TitleKind;
  name: string;
  via: "queue" | "watched";
  rating: number | null;
};

/** A film listed by TMDB (`/recommendations` or `/discover`), before we know more about it. */
export type RecoCandidate = {
  /** `MOVIE:603`. */
  key: string;
  /** Deterministic `Catalog.id` (`catalogIdFor`); also the engine's id for the recommendation. */
  catalogId: string;
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName: string | null;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  voteAverage: number | null;
  voteCount: number;
  genreIds: number[];
  sources: Array<{ kind: RecoSourceKind; seed: RecoSeed | null }>;
};

/** A recommendation ranked by the engine: `titleId` is the film's `catalogId`. */
export type RecoPick = TonightPickBase & {
  catalogId: string;
  sourceKind: RecoSourceKind;
  seed: RecoSeed | null;
  candidate: RecoCandidate;
  genres: TonightGenre[];
};
