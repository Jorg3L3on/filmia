import { TitleKind } from "@/db";
import { EMPTY_SCORE, fetchImdbScore, isOmdbConfigured } from "@/lib/omdb";
import {
  getTmdbDetails,
  getTmdbExternalIds,
  isTmdbConfigured,
  searchTmdbMulti,
  searchTmdbMultiPage,
  type TmdbGenre,
  type TmdbKeyword,
  type TmdbPerson,
} from "@/lib/tmdb";

export type TitleMetadata = {
  tmdbId: number | null;
  posterPath: string | null;
  backdropPath?: string | null;
  runtimeMinutes?: number | null;
  imdbId: string | null;
  imdbRating: number | null;
  imdbVotes?: number | null;
  /** Raw OMDb awards sentence (see `src/lib/awards.ts`). */
  awards?: string | null;
  /** Rotten Tomatoes / Metascore, 0–100 (FIL-I36). */
  rtScore?: number | null;
  metascore?: number | null;
  tmdbGenres: TmdbGenre[];
  tmdbKeywords?: TmdbKeyword[];
  tmdbPeople?: TmdbPerson[];
  originalLanguage?: string | null;
  overview?: string | null;
  name?: string;
  originalName?: string | null;
  year?: number | null;
};

export const metadataServicesConfigured = () => ({
  tmdb: isTmdbConfigured(),
  omdb: isOmdbConfigured(),
});

export const resolveTitleMetadata = async (
  tmdbId: number,
  kind: TitleKind,
): Promise<TitleMetadata> => {
  const [details, imdbId] = await Promise.all([
    getTmdbDetails(tmdbId, kind),
    getTmdbExternalIds(tmdbId, kind),
  ]);

  const score = imdbId ? await fetchImdbScore(imdbId) : EMPTY_SCORE;

  return {
    tmdbId: details.tmdbId,
    posterPath: details.posterPath,
    backdropPath: details.backdropPath,
    runtimeMinutes: details.runtimeMinutes,
    imdbId,
    imdbRating: score.rating,
    imdbVotes: score.votes,
    awards: score.awards,
    rtScore: score.rt,
    metascore: score.metascore,
    tmdbGenres: details.genres,
    tmdbKeywords: details.keywords,
    tmdbPeople: details.people,
    originalLanguage: details.originalLanguage,
    overview: details.overview,
    name: details.name,
    originalName: details.originalName,
    year: details.year,
  };
};

export const searchTmdbCatalog = searchTmdbMulti;
export const searchTmdbCatalogPage = searchTmdbMultiPage;
