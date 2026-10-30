import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";
import {
  collectRatings,
  ImdbRatingsUnavailable,
  parseRatingLine,
  readImdbRatings,
} from "./imdb-ratings";

// Synthetic rows only: never extracts of IMDb's file (the repo is public).
const FIXTURE = [
  "tconst\taverageRating\tnumVotes",
  "tt0000001\t5.7\t2100",
  "tt0000002\tbroken",
  "tt0000003\t7.5\t117433",
  "tt0000004\t6.1\t40",
  "nm0000005\t8.0\t900",
  "tt0000006\t8.4\t52000",
];

const linesOf = (rows: readonly string[], counter = { read: 0 }) => ({
  counter,
  async *[Symbol.asyncIterator]() {
    for (const row of rows) {
      counter.read += 1;
      yield row;
    }
  },
});

const gzipResponse = (rows: readonly string[]) => new Response(gzipSync(`${rows.join("\n")}\n`));

describe("parseRatingLine", () => {
  it("reads a valid row as rating (number) and votes (integer)", () => {
    assert.deepEqual(parseRatingLine("tt0000003\t7.5\t117433"), { tconst: "tt0000003", rating: 7.5, votes: 117_433 });
    assert.deepEqual(parseRatingLine("tt0000003\t7.5\t117433\r"), { tconst: "tt0000003", rating: 7.5, votes: 117_433 });
  });

  it("skips the header and malformed rows", () => {
    assert.equal(parseRatingLine("tconst\taverageRating\tnumVotes"), null);
    assert.equal(parseRatingLine("tt0000002\tbroken"), null);
    assert.equal(parseRatingLine("tt0000002\tN/A\t10"), null);
    assert.equal(parseRatingLine("tt0000002\t7.1\t10.5"), null);
    assert.equal(parseRatingLine("tt0000002\t11\t10"), null);
    assert.equal(parseRatingLine("tt0000002\t7.1\t10\textra"), null);
    assert.equal(parseRatingLine("nm0000005\t8.0\t900"), null);
    assert.equal(parseRatingLine(""), null);
  });
});

describe("collectRatings", () => {
  it("returns only the requested ids; ids without a row are left out", async () => {
    const found = await collectRatings(linesOf(FIXTURE), new Set(["tt0000003", "tt0000002", "tt9999999"]));
    assert.deepEqual([...found], [["tt0000003", { rating: 7.5, votes: 117_433 }]]);
  });

  it("stops reading once every id is found", async () => {
    const lines = linesOf(FIXTURE);
    const found = await collectRatings(lines, new Set(["tt0000001", "tt0000003"]));
    assert.equal(found.size, 2);
    assert.equal(lines.counter.read, 4);
  });

  it("reads the whole file when an id never shows up", async () => {
    const lines = linesOf(FIXTURE);
    await collectRatings(lines, new Set(["tt0000001", "tt9999999"]));
    assert.equal(lines.counter.read, FIXTURE.length);
  });

  it("reads nothing for no ids", async () => {
    const lines = linesOf(FIXTURE);
    assert.equal((await collectRatings(lines, new Set())).size, 0);
    assert.equal(lines.counter.read, 0);
  });
});

describe("readImdbRatings", () => {
  it("gunzips the download and returns the requested rows", async () => {
    let calls = 0;
    const found = await readImdbRatings(new Set(["tt0000006", "tt0000004", "tt0000404"]), {
      fetch: async () => {
        calls += 1;
        return gzipResponse(FIXTURE);
      },
    });
    assert.equal(calls, 1);
    assert.deepEqual(
      Object.fromEntries(found),
      { tt0000004: { rating: 6.1, votes: 40 }, tt0000006: { rating: 8.4, votes: 52_000 } },
    );
    for (const { votes } of found.values()) {
      assert.ok(Number.isInteger(votes));
    }
  });

  it("stops the download once every id is found", async () => {
    // A file far bigger than one chunk: if the reader kept going it would pull it all.
    const filler = Array.from({ length: 200_000 }, (_, index) => `tt${String(index + 100).padStart(8, "0")}\t6.0\t10`);
    let pulled = 0;
    const body = gzipSync(`${[...FIXTURE, ...filler].join("\n")}\n`);
    const chunk = 1024;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled >= body.length) {
          controller.close();
          return;
        }
        controller.enqueue(body.subarray(pulled, pulled + chunk));
        pulled += chunk;
      },
    });
    const found = await readImdbRatings(new Set(["tt0000003"]), { fetch: async () => new Response(stream) });
    assert.deepEqual(found.get("tt0000003"), { rating: 7.5, votes: 117_433 });
    assert.ok(pulled < body.length / 2, `pulled ${pulled} of ${body.length} bytes`);
  });

  it("does not download for no ids", async () => {
    let calls = 0;
    const found = await readImdbRatings(new Set(), {
      fetch: async () => {
        calls += 1;
        return gzipResponse(FIXTURE);
      },
    });
    assert.equal(found.size, 0);
    assert.equal(calls, 0);
  });

  it("throws ImdbRatingsUnavailable on a network error", async () => {
    await assert.rejects(
      readImdbRatings(new Set(["tt0000003"]), {
        fetch: async () => {
          throw new TypeError("fetch failed");
        },
      }),
      (error) => error instanceof ImdbRatingsUnavailable && error.reason === "fetch fetch failed",
    );
  });

  it("throws ImdbRatingsUnavailable on a bad status", async () => {
    await assert.rejects(
      readImdbRatings(new Set(["tt0000003"]), { fetch: async () => new Response("gone", { status: 503 }) }),
      (error) => error instanceof ImdbRatingsUnavailable && error.reason === "status 503",
    );
  });

  it("throws ImdbRatingsUnavailable on a body that is not gzip", async () => {
    await assert.rejects(
      readImdbRatings(new Set(["tt0000003"]), { fetch: async () => new Response(FIXTURE.join("\n")) }),
      (error) => error instanceof ImdbRatingsUnavailable && error.reason.startsWith("read "),
    );
  });

  it("throws ImdbRatingsUnavailable on a timeout", async () => {
    const stalled = new ReadableStream<Uint8Array>({ pull: () => new Promise(() => {}) });
    await assert.rejects(
      readImdbRatings(new Set(["tt0000003"]), { timeoutMs: 50, fetch: async () => new Response(stalled) }),
      (error) => error instanceof ImdbRatingsUnavailable && error.reason === "timeout",
    );
  });
});
