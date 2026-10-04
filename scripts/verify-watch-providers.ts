import {
  fetchMxWatchProviders,
  parseMxWatchProviders,
  titleNeedsWatchProvidersRefresh,
  WATCH_PROVIDERS_CACHE_TTL_MS,
} from "../src/lib/watch-providers";
import { isTmdbConfigured } from "../src/lib/tmdb";
import { TitleKind } from "../src/db";

const mockResponse = {
  id: 550,
  results: {
    MX: {
      link: "https://www.themoviedb.org/movie/550/watch?locale=MX",
      flatrate: [
        {
          provider_id: 8,
          provider_name: "Netflix",
          logo_path: "/t2yyOv40HZOtv8m4CG4j1vCh4F.jpg",
          display_priority: 0,
        },
        {
          provider_id: 337,
          provider_name: "Disney Plus",
          logo_path: "/3TVIzI2JTB12GxfLhHDR0X5Lc4.jpg",
          display_priority: 3,
        },
      ],
      rent: [
        {
          provider_id: 2,
          provider_name: "Apple TV",
          logo_path: "/peURlLlr8jggOwK53fJG5XIzqK.jpg",
          display_priority: 4,
        },
      ],
      buy: [],
    },
  },
};

const run = async () => {
  const parsed = parseMxWatchProviders(mockResponse);

  console.log("✓ Mock parse:", {
    flatrate: parsed.flatrate.map((p) => p.name),
    rent: parsed.rent.map((p) => p.name),
    buy: parsed.buy.length,
    link: parsed.link,
  });

  const empty = parseMxWatchProviders({ results: { US: { flatrate: [] } } });
  if (
    empty.link !== null ||
    empty.flatrate.length > 0 ||
    empty.rent.length > 0 ||
    empty.buy.length > 0
  ) {
    throw new Error("Expected empty lists for missing MX region");
  }
  console.log("✓ Missing MX region returns empty lists (checked, not available)");

  if (!titleNeedsWatchProvidersRefresh(null, null)) {
    throw new Error("Missing cache without fetchedAt should refresh");
  }
  if (
    titleNeedsWatchProvidersRefresh(null, new Date()) ||
    titleNeedsWatchProvidersRefresh(parsed, null)
  ) {
    throw new Error("Fresh empty lookup or stored providers should not refresh");
  }
  const staleFetchedAt = new Date(Date.now() - WATCH_PROVIDERS_CACHE_TTL_MS - 1);
  if (!titleNeedsWatchProvidersRefresh(null, staleFetchedAt)) {
    throw new Error("Stale empty lookup should refresh");
  }
  console.log("✓ Provider refresh skips a fresh null MX lookup");

  if (isTmdbConfigured()) {
    const live = await fetchMxWatchProviders(1396, TitleKind.SERIES);
    console.log("✓ Live TMDB (Breaking Bad):", {
      flatrate: live.flatrate.map((p) => p.name),
      rent: live.rent.map((p) => p.name),
      buy: live.buy.map((p) => p.name),
    });
  } else {
    console.log("ℹ TMDB_API_KEY not set — skipped live API test");
  }

  console.log("\nAll watch provider checks passed.");
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
