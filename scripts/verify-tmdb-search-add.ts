import { config as loadEnv } from "dotenv";
import { hash } from "bcryptjs";

loadEnv({ path: ".env.local" });
loadEnv();

import { TitleKind } from "../src/generated/prisma/client";
import { upsertTitleFromTmdbForUser } from "../src/lib/add-title-from-tmdb";
import { prisma } from "../src/lib/prisma";
import {
  searchTmdbMulti,
  TmdbRequestError,
  tmdbErrorMessage,
} from "../src/lib/tmdb";

const TEST_EMAIL = "tmdb-search-test@filmia.local";
const TEST_TMDB_ID = 9000155;

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const withMockFetch = async (
  impl: typeof fetch,
  run: () => Promise<void>,
) => {
  const previous = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    await run();
  } finally {
    globalThis.fetch = previous;
  }
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const verifyErrors = async () => {
  const previousKey = process.env.TMDB_API_KEY;
  delete process.env.TMDB_API_KEY;

  try {
    await searchTmdbMulti("Dune");
    throw new Error("Expected missing-key error");
  } catch (error) {
    if (!(error instanceof TmdbRequestError)) {
      throw new Error("Missing key should be TmdbRequestError");
    }
    if (error.code !== "missing_key") {
      throw new Error(`Expected missing_key, got ${error.code}`);
    }
    if (!tmdbErrorMessage(error).includes("TMDB_API_KEY")) {
      throw new Error("Missing key message should mention TMDB_API_KEY");
    }
    console.log("✓ Missing TMDB_API_KEY:", tmdbErrorMessage(error));
  }

  process.env.TMDB_API_KEY = "test-key";

  await withMockFetch(async () => {
    throw new TypeError("fetch failed");
  }, async () => {
    try {
      await searchTmdbMulti("Dune");
      throw new Error("Expected network error");
    } catch (error) {
      if (!(error instanceof TmdbRequestError) || error.code !== "network") {
        throw new Error("Expected network TmdbRequestError");
      }
      console.log("✓ Network error:", tmdbErrorMessage(error));
    }
  });

  await withMockFetch(async () => jsonResponse({ status_message: "slow down" }, 429), async () => {
    try {
      await searchTmdbMulti("Dune");
      throw new Error("Expected rate-limit error");
    } catch (error) {
      if (!(error instanceof TmdbRequestError) || error.code !== "rate_limit") {
        throw new Error("Expected rate_limit TmdbRequestError");
      }
      console.log("✓ Rate limit:", tmdbErrorMessage(error));
    }
  });

  await withMockFetch(async (input) => {
    const url = String(input);
    assert(url.includes("/search/multi"), `Unexpected URL ${url}`);
    return jsonResponse({
      results: [
        {
          id: 438631,
          media_type: "movie",
          title: "Dune",
          original_title: "Dune",
          release_date: "2021-10-22",
          poster_path: "/dune.jpg",
        },
        {
          id: 52814,
          media_type: "tv",
          name: "Dune",
          first_air_date: "2000-12-03",
          poster_path: "/dune-tv.jpg",
        },
        {
          id: 1,
          media_type: "person",
          name: "Denis Villeneuve",
        },
      ],
    });
  }, async () => {
    const results = await searchTmdbMulti("Dune");
    assert(results.length === 2, `Expected 2 catalog hits, got ${results.length}`);
    assert(results[0]?.kind === TitleKind.MOVIE, "First hit should be movie");
    assert(results[0]?.year === 2021, "Movie year should parse");
    assert(results[1]?.kind === TitleKind.SERIES, "Second hit should be series");
    console.log(
      "✓ Multi search maps poster/year/type:",
      results.map((item) => `${item.name} ${item.year} ${item.kind}`),
    );
  });

  if (previousKey === undefined) {
    delete process.env.TMDB_API_KEY;
  } else {
    process.env.TMDB_API_KEY = previousKey;
  }
};

const verifyUpsert = async () => {
  const passwordHash = await hash("filmia-test-155", 10);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: {
      email: TEST_EMAIL,
      passwordHash,
      name: "TMDB search test",
    },
  });

  await prisma.title.deleteMany({
    where: { userId: user.id, tmdbId: TEST_TMDB_ID },
  });

  const first = await upsertTitleFromTmdbForUser(user.id, {
    tmdbId: TEST_TMDB_ID,
    kind: TitleKind.MOVIE,
    name: "Dune",
    year: 2021,
    posterPath: "/dune.jpg",
    addToWatchlist: true,
  });

  assert(first.ok && first.created, "First add should create the title");
  assert(first.ok && first.addedToWatchlist, "First add should enqueue watchlist");

  const second = await upsertTitleFromTmdbForUser(user.id, {
    tmdbId: TEST_TMDB_ID,
    kind: TitleKind.MOVIE,
    name: "Dune Duplicate",
    year: 2024,
    posterPath: "/other.jpg",
    addToWatchlist: true,
  });

  assert(second.ok && !second.created, "Second add should reuse the title");
  assert(first.ok && second.ok && first.titleId === second.titleId, "Same title id");

  const copies = await prisma.title.count({
    where: { userId: user.id, tmdbId: TEST_TMDB_ID },
  });
  assert(copies === 1, `Expected 1 title, found ${copies}`);

  const stored = await prisma.title.findFirst({
    where: { id: first.ok ? first.titleId : "" },
    select: {
      name: true,
      year: true,
      posterPath: true,
      kind: true,
      tmdbId: true,
    },
  });

  assert(stored?.name === "Dune", "Persisted name");
  assert(stored?.year === 2021, "Persisted year");
  assert(stored?.posterPath === "/dune.jpg", "Persisted poster");
  assert(stored?.kind === TitleKind.MOVIE, "Persisted kind");
  assert(stored?.tmdbId === TEST_TMDB_ID, "Persisted tmdbId");

  const watchlistItems = await prisma.listItem.count({
    where: {
      titleId: first.ok ? first.titleId : "",
      list: { userId: user.id, slug: "watchlist" },
    },
  });
  assert(watchlistItems === 1, "Should be in Quiero ver once");

  await prisma.title.deleteMany({
    where: { userId: user.id, tmdbId: TEST_TMDB_ID },
  });
  await prisma.user.delete({ where: { id: user.id } });

  console.log("✓ Upsert by userId+tmdbId keeps a single title and can enqueue Quiero ver");
};

const run = async () => {
  await verifyErrors();
  await verifyUpsert();
  console.log("\nAll TMDB search/add checks passed.");
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
