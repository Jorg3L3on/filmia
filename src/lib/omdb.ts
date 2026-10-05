import { unstable_cache } from "next/cache";
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
  Error?: string;
};

export type ImdbScore = {
  rating: number | null;
  /** OMDb sends `"2,565,017"`; parsed to an integer, null when N/A. */
  votes: number | null;
};

const parseVotes = (value: string | undefined) => {
  if (!value || value === "N/A") {
    return null;
  }
  const votes = Number(value.replace(/[^0-9]/g, ""));
  return Number.isInteger(votes) && votes > 0 ? votes : null;
};

export const fetchImdbRating = async (imdbId: string): Promise<number | null> =>
  (await fetchImdbScore(imdbId)).rating;

export const fetchImdbScore = async (imdbId: string): Promise<ImdbScore> => {
  const apiKey = getOmdbApiKey();
  if (!apiKey || !imdbId) {
    return { rating: null, votes: null };
  }

  try {
    return await loadCachedOmdbScore(imdbId);
  } catch {
    // No Next cache scope (scripts / cron): plain fetch.
    return fetchOmdbScore(imdbId);
  }
};

const fetchOmdbScore = async (imdbId: string): Promise<ImdbScore> => {
  const apiKey = getOmdbApiKey();
  if (!apiKey || !imdbId) {
    return { rating: null, votes: null };
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
  if (!response.ok) {
    return { rating: null, votes: null };
  }

  const data = (await response.json()) as OmdbResponse;
  if (data.Response !== "True") {
    return { rating: null, votes: null };
  }

  const rating =
    data.imdbRating && data.imdbRating !== "N/A" ? Number(data.imdbRating) : null;
  return {
    rating: rating != null && Number.isFinite(rating) ? rating : null,
    votes: parseVotes(data.imdbVotes),
  };
};

const loadCachedOmdbScore = unstable_cache(fetchOmdbScore, ["omdb-imdb-score"], {
  revalidate: METADATA_REVALIDATE_SECONDS,
  tags: [OMDB_CACHE_TAG],
});
