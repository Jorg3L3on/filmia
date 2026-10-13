import type { CoverflowTitle } from "@/components/coverflow/types";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { previewFichaHref } from "@/lib/title-preview";

/** Who an event is about: a title of the library, or a recommended film by its catalog id. */
export type PickRef = { titleId: string } | { catalogId: string };

export const pickRefOf = (title: { id: string; tonight?: { source?: "queue" | "reco" } }): PickRef =>
  title.tonight?.source === "reco" ? { catalogId: title.id } : { titleId: title.id };

/** A recommended card's ficha preview by TMDB (FIL-I8); null for a queue card. */
export const recoPreviewHref = (card: CoverflowTitle): string | null => {
  const reco = card.tonight?.reco;
  return reco ? previewFichaHref(card.kind, reco.tmdbId) : null;
};

/** The recommended card as a TMDB search result (what Buscar's actions take); null for a queue card. */
export const recoResultOf = (card: CoverflowTitle): TmdbCatalogResult | null => {
  const reco = card.tonight?.reco;
  if (!reco) {
    return null;
  }
  return {
    tmdbId: reco.tmdbId,
    kind: card.kind,
    name: card.name,
    originalName: reco.originalName,
    year: card.year,
    posterPath: card.posterPath,
    backdropPath: reco.backdropPath,
    overview: reco.overview,
  };
};
