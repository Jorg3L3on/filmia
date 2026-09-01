const OMDB_BASE = "https://www.omdbapi.com/";

const getOmdbApiKey = () => process.env.OMDB_API_KEY?.trim() ?? "";

export const isOmdbConfigured = () => Boolean(getOmdbApiKey());

type OmdbResponse = {
  Response: "True" | "False";
  imdbRating?: string;
  Error?: string;
};

export const fetchImdbRating = async (imdbId: string): Promise<number | null> => {
  const apiKey = getOmdbApiKey();
  if (!apiKey || !imdbId) {
    return null;
  }

  const url = new URL(OMDB_BASE);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("i", imdbId);

  const response = await fetch(url, { next: { revalidate: 86400 } });
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as OmdbResponse;
  if (data.Response !== "True" || !data.imdbRating || data.imdbRating === "N/A") {
    return null;
  }

  const rating = Number(data.imdbRating);
  return Number.isFinite(rating) ? rating : null;
};
