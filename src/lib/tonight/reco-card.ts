import type { CoverflowTitle } from "@/components/coverflow/types";
import type { TmdbCatalogResult } from "@/lib/tmdb";

/** Who an event is about: a title of the library, or a recommended film by its catalog id. */
export type PickRef = { titleId: string } | { catalogId: string };

export const pickRefOf = (title: { id: string; tonight?: { source?: "queue" | "reco" } }): PickRef =>
  title.tonight?.source === "reco" ? { catalogId: title.id } : { titleId: title.id };

/** The recommended card as the Buscar preview sheet reads a TMDB result; null for a queue card. */
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
