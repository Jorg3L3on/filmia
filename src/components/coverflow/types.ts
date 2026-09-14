import type { Platform, SeriesStatus, TitleKind } from "@/db";
import type { WatchProviderOffer } from "@/lib/watch-providers";

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
};

export type CoverflowDeckProps = {
  titles: CoverflowTitle[];
  className?: string;
  listId?: string;
  variant?: "page" | "sheet";
  onActiveChange?: (index: number, title: CoverflowTitle) => void;
  /** `watched` = Qué ver picks: cinematic meta + slide, eye on posters. */
  footer?: "full" | "watched";
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
