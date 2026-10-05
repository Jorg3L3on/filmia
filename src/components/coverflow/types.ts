import type { Platform, SeriesStatus, TitleKind } from "@/db";
import type { TonightFit, TonightReason } from "@/lib/tonight/types";
import type { WatchProviderOffer } from "@/lib/watch-providers";

/** Esta noche extras on a card: why it is here, how it fits the night. */
export type CoverflowTonightMeta = {
  runtimeMinutes: number | null;
  reasons: TonightReason[];
  headline: TonightReason[];
  fit: TonightFit;
  wildcard: boolean;
  queueNote: string | null;
  lens: string;
  posterAmbient: string | null;
};

export type CoverflowGenre = {
  id: number;
  name: string;
};

export type CoverflowTitle = {
  id: string;
  name: string;
  kind: TitleKind;
  year: number | null;
  rating: number | null;
  posterPath: string | null;
  platform: Platform | null;
  imdbRating: number | null;
  watched?: boolean;
  review?: string | null;
  seriesStatus?: SeriesStatus | null;
  seriesSeason?: number | null;
  flatrateProviders?: WatchProviderOffer[];
  /** TMDB genres for cinematic Qué ver meta line. */
  genres?: CoverflowGenre[];
  /** Present only inside the Esta noche sala. */
  tonight?: CoverflowTonightMeta;
};

export type CoverflowDeckProps = {
  titles: CoverflowTitle[];
  className?: string;
  listId?: string;
  /** Tag detail: footer becomes a single «Quitar de esta etiqueta» action. */
  tagId?: string;
  variant?: "page" | "sheet";
  onActiveChange?: (index: number, title: CoverflowTitle) => void;
  /** `watched` = cinematic meta only; `tonight` = Esta noche (stub, reasons, chips). */
  footer?: "full" | "watched" | "tonight";
  /** Focused card on mount / remount (category continuum). */
  initialIndex?: number;
  /** Swipe/wheel past first/last card → neighboring category (Qué ver). */
  onEdgeNavigate?: (direction: "prev" | "next") => void;
  /** Category continuum labels for frosted destination side slots. */
  edgeNeighbors?: {
    prev: { name: string } | null;
    next: { name: string } | null;
  };
};
