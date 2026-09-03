import { Platform } from "../src/generated/prisma/client";
import { parseStreamingPlatforms } from "../src/lib/form-data";
import {
  applyMinePlatformsFilter,
  formatUserPlatformsList,
  isUserStreamingProvider,
  matchWatchProviderPlatform,
  parseStoredStreamingPlatforms,
  resolveMinePlatformsCatalog,
  titleAvailableOnUserPlatforms,
  userStreamingProviderIds,
} from "../src/lib/streaming-platforms";
import type { WatchProvidersMxData } from "../src/lib/watch-providers";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const provider = (providerId: number, name: string) => ({
  providerId,
  name,
  logoPath: null,
  logoUrl: null,
});

const run = () => {
  assert(
    JSON.stringify(parseStoredStreamingPlatforms(["DISNEY", "NETFLIX", "HULU"])) ===
      JSON.stringify([Platform.NETFLIX, Platform.DISNEY]),
    "Stored JSON should keep Platform order and drop unknown values",
  );
  assert(
    parseStoredStreamingPlatforms("NETFLIX").length === 0,
    "Non-array JSON should yield empty prefs",
  );
  assert(
    parseStoredStreamingPlatforms([]).length === 0,
    "Empty prefs should stay empty",
  );

  const form = new FormData();
  form.append("platforms", "MAX");
  form.append("platforms", "NETFLIX");
  form.append("platforms", "MAX");
  assert(
    JSON.stringify(parseStreamingPlatforms(form)) ===
      JSON.stringify([Platform.NETFLIX, Platform.MAX]),
    "Form checkboxes should de-dupe and sort by catalog order",
  );

  const emptyForm = new FormData();
  assert(
    parseStreamingPlatforms(emptyForm).length === 0,
    "No checkboxes should save empty prefs",
  );

  assert(
    matchWatchProviderPlatform(provider(8, "Netflix")) === Platform.NETFLIX,
    "Netflix should match by TMDB id",
  );
  assert(
    matchWatchProviderPlatform(provider(337, "Disney Plus")) === Platform.DISNEY,
    "Disney Plus should match by TMDB id",
  );
  assert(
    matchWatchProviderPlatform(provider(9999, "Disney+")) === Platform.DISNEY,
    "Disney+ should match by name",
  );
  assert(
    matchWatchProviderPlatform(provider(9999, "Amazon Prime Video")) === Platform.PRIME,
    "Amazon Prime Video should match Prime by name",
  );
  assert(
    matchWatchProviderPlatform(provider(9999, "HBO Max")) === Platform.MAX,
    "HBO Max should match Max by name",
  );
  assert(
    matchWatchProviderPlatform(provider(1899, "Max")) === Platform.MAX,
    "Max should match by TMDB id",
  );
  assert(
    matchWatchProviderPlatform(provider(2, "Apple TV")) === Platform.APPLE,
    "Apple TV should match by TMDB id",
  );
  assert(
    matchWatchProviderPlatform(provider(167, "Claro video")) === Platform.CLARO,
    "Claro video should match by TMDB id",
  );
  assert(
    matchWatchProviderPlatform(provider(11, "MUBI")) === Platform.MUBI,
    "MUBI should match by TMDB id",
  );
  assert(
    matchWatchProviderPlatform(provider(10, "Amazon Video")) === null,
    "Amazon Video (rent/buy) should not match Prime",
  );
  assert(
    matchWatchProviderPlatform(provider(9999, "Cinemax")) === null,
    "Cinemax should not match Max",
  );

  const mine = [Platform.NETFLIX, Platform.DISNEY];
  assert(
    isUserStreamingProvider(provider(8, "Netflix"), mine),
    "User Netflix should highlight Netflix",
  );
  assert(
    isUserStreamingProvider(provider(337, "Disney Plus"), mine),
    "User Disney should highlight Disney Plus",
  );
  assert(
    !isUserStreamingProvider(provider(119, "Amazon Prime Video"), mine),
    "Prime should not highlight if the user did not pick it",
  );
  assert(
    !isUserStreamingProvider(provider(8, "Netflix"), []),
    "Empty prefs should not highlight",
  );

  const data: WatchProvidersMxData = {
    link: null,
    flatrate: [provider(8, "Netflix"), provider(119, "Amazon Prime Video")],
    rent: [provider(2, "Apple TV")],
    buy: [],
  };

  assert(
    titleAvailableOnUserPlatforms(data, [Platform.NETFLIX]),
    "JOR-157 helper: Netflix flatrate is available for a Netflix user",
  );
  assert(
    !titleAvailableOnUserPlatforms(data, [Platform.MAX]),
    "JOR-157 helper: Max user should not match Netflix/Prime-only flatrate",
  );
  assert(
    !titleAvailableOnUserPlatforms(data, [Platform.APPLE]),
    "JOR-157 helper: Apple on rent should not count as included",
  );
  assert(
    !titleAvailableOnUserPlatforms(null, [Platform.NETFLIX]),
    "JOR-157 helper: missing providers is not available",
  );

  const netflixTitle = {
    id: "n",
    watchProvidersMx: {
      link: null,
      flatrate: [provider(8, "Netflix")],
      rent: [],
      buy: [],
    },
  };
  const primeTitle = {
    id: "p",
    watchProvidersMx: {
      link: null,
      flatrate: [provider(119, "Amazon Prime Video")],
      rent: [],
      buy: [],
    },
  };
  const maxRentOnly = {
    id: "m",
    watchProvidersMx: {
      link: null,
      flatrate: [],
      rent: [provider(1899, "Max")],
      buy: [],
    },
  };
  const noCacheTitle = { id: "x", watchProvidersMx: null };
  const mineNetflixDisney = [Platform.NETFLIX, Platform.DISNEY];

  const filtered = applyMinePlatformsFilter(
    [netflixTitle, primeTitle, maxRentOnly, noCacheTitle],
    mineNetflixDisney,
  );
  assert(
    filtered.visible.map((title) => title.id).join(",") === "n",
    "Filter should keep Netflix and hide Prime/Max rent/no-cache",
  );
  assert(filtered.missingCache === 1, "Titles without watchProvidersMx should be excluded and counted");

  const setup = resolveMinePlatformsCatalog([netflixTitle], true, []);
  assert(setup.needsSetup, "Empty prefs with filter on should signal perfil CTA");
  assert(setup.titles.length === 0, "Empty prefs should not yield misleading matches");

  const off = resolveMinePlatformsCatalog([primeTitle], false, mineNetflixDisney);
  assert(off.titles.length === 1, "Filter off should keep Prime-only titles");

  assert(
    formatUserPlatformsList([Platform.NETFLIX, Platform.DISNEY]) === "Netflix o Disney+",
    "Platform list should join two names with o",
  );

  const ids = userStreamingProviderIds([Platform.NETFLIX, Platform.APPLE]);
  assert(ids.includes(8) && ids.includes(2) && ids.includes(350), "TMDB id map should expand Apple + Netflix");

  console.log("✓ Streaming platform prefs parse, match, and highlight helpers");
  console.log("All streaming platform checks passed.");
};

run();
