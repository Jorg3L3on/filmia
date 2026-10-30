import { unstable_cache } from "next/cache";
import { recordApiCall } from "@/lib/api-usage";
import { parseMetascore, parseRottenTomatoes, type OmdbRatingEntry } from "@/lib/critic-scores";
import {
  METADATA_REVALIDATE_SECONDS,
  OMDB_CACHE_TAG,
} from "@/lib/rendering";

const OMDB_BASE = "https://www.omdbapi.com/";

const getOmdbApiKey = () => process.env.OMDB_API_KEY?.trim() ?? "";

export const isOmdbConfigured = () => Boolean(getOmdbApiKey());

type OmdbResponse = {
  Response: "True" | "False";
  imdbRating?: string;
  imdbVotes?: string;
  /** e.g. "Won 2 Oscars. 23 wins & 12 nominations total." or "N/A". */
  Awards?: string;
  /** Other sources, e.g. `{ Source: "Rotten Tomatoes", Value: "96%" }`. */
  Ratings?: OmdbRatingEntry[];
  /** "72" or "N/A". */
  Metascore?: string;
  Error?: string;
};

export type ImdbScore = {
  rating: number | null;
  /** OMDb sends `"2,565,017"`; parsed to an integer, null when N/A. */
  votes: number | null;
  /** Raw OMDb awards sentence; parsed for display by `src/lib/awards.ts`. */
  awards: string | null;
  /** Tomatometer 0–100 (FIL-I36); null when OMDb has none. */
  rt: number | null;
  /** Metascore 0–100 (FIL-I36); null when N/A. */
  metascore: number | null;
};

export const EMPTY_SCORE: ImdbScore = { rating: null, votes: null, awards: null, rt: null, metascore: null };

const parseVotes = (value: string | undefined) => {
  if (!value || value === "N/A") {
    return null;
  }
  const votes = Number(value.replace(/[^0-9]/g, ""));
  return Number.isInteger(votes) && votes > 0 ? votes : null;
};

const parseAwards = (value: string | undefined) => {
  const trimmed = value?.trim() ?? "";
  return trimmed && trimmed !== "N/A" ? trimmed : null;
};

export const fetchImdbRating = async (imdbId: string): Promise<number | null> =>
  (await fetchImdbScore(imdbId)).rating;

export const fetchImdbScore = async (imdbId: string): Promise<ImdbScore> => {
  const apiKey = getOmdbApiKey();
  if (!apiKey || !imdbId) {
    return EMPTY_SCORE;
  }

  try {
    return await loadCachedOmdbScore(imdbId);
  } catch {
    // No Next cache scope (scripts / cron): plain fetch.
    return fetchOmdbScore(imdbId);
  }
};

/** OMDb refused the key: daily limit reached (free tier: 1 000/day) or the key is invalid. Both answer 401. */
export class OmdbRefusedError extends Error {}

/**
 * One OMDb lookup that tells the caller whether OMDb actually answered.
 * `answered: false` = network or server error, worth retrying another day; a title OMDb
 * does not know counts as answered. Throws `OmdbRefusedError` on 401 so a backfill can stop.
 */
export const lookupOmdbScore = async (
  imdbId: string,
): Promise<{ score: ImdbScore; answered: boolean }> => {
  const apiKey = getOmdbApiKey();
  if (!apiKey || !imdbId) {
    return { score: EMPTY_SCORE, answered: false };
  }

  const url = new URL(OMDB_BASE);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("i", imdbId);

  const response = await fetch(url, {
    next: {
      revalidate: METADATA_REVALIDATE_SECONDS,
      tags: [OMDB_CACHE_TAG],
    },
  });
  recordApiCall("omdb");
  if (response.status === 401) {
    const data = (await response.json().catch(() => null)) as OmdbResponse | null;
    throw new OmdbRefusedError(data?.Error ?? "OMDb respondió 401");
  }
  if (!response.ok) {
    return { score: EMPTY_SCORE, answered: false };
  }

  const data = (await response.json()) as OmdbResponse;
  if (data.Response !== "True") {
    return { score: EMPTY_SCORE, answered: true };
  }

  const rating =
    data.imdbRating && data.imdbRating !== "N/A" ? Number(data.imdbRating) : null;
  return {
    score: {
      rating: rating != null && Number.isFinite(rating) ? rating : null,
      votes: parseVotes(data.imdbVotes),
      awards: parseAwards(data.Awards),
      rt: parseRottenTomatoes(data.Ratings),
      metascore: parseMetascore(data.Metascore),
    },
    answered: true,
  };
};

const fetchOmdbScore = async (imdbId: string): Promise<ImdbScore> => {
  try {
    return (await lookupOmdbScore(imdbId)).score;
  } catch (error) {
    if (error instanceof OmdbRefusedError) {
      return EMPTY_SCORE;
    }
    throw error;
  }
};

// Key bumped when the shape grows (v2 `awards`, v3 `rt` + `metascore`): older cached entries lack them.
const loadCachedOmdbScore = unstable_cache(fetchOmdbScore, ["omdb-imdb-score", "v3"], {
  revalidate: METADATA_REVALIDATE_SECONDS,
  tags: [OMDB_CACHE_TAG],
});
