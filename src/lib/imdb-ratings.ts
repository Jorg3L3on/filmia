/**
 * IMDb's own ratings file (FIL-I35): `title.ratings.tsv.gz`, read as a stream for just the ids a
 * run needs. OMDb answers N/A for some films the file has (Resident Evil: Noche cero), so the
 * yearly top asks here first. The datasets are for personal, non-commercial use only: if Filmia
 * ever charges or shows ads, this source has to be licensed or dropped.
 */

import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import { createGunzip } from "node:zlib";

export const IMDB_RATINGS_URL = "https://datasets.imdbws.com/title.ratings.tsv.gz";
/** ~8.7 MB compressed reads in about a second; the cron's 300 s must never wait on it. */
export const IMDB_RATINGS_TIMEOUT_MS = 60_000;

export type ImdbRating = { rating: number; votes: number };

/** The file could not be read: the caller keeps OMDb. `reason` goes to the log. */
export class ImdbRatingsUnavailable extends Error {
  constructor(readonly reason: string) {
    super(`imdb-ratings: unavailable ${reason}`);
    this.name = "ImdbRatingsUnavailable";
  }
}

const TCONST = /^tt\d+$/;

/** One `tconst\taverageRating\tnumVotes` row; null for the header and anything malformed. */
export const parseRatingLine = (line: string): ({ tconst: string } & ImdbRating) | null => {
  const [tconst, rawRating, rawVotes, ...rest] = line.trimEnd().split("\t");
  if (rest.length > 0 || !tconst || !TCONST.test(tconst) || !rawRating || !rawVotes) {
    return null;
  }
  const rating = Number(rawRating);
  const votes = Number(rawVotes);
  if (!Number.isFinite(rating) || rating < 0 || rating > 10 || !Number.isInteger(votes) || votes < 0) {
    return null;
  }
  return { tconst, rating, votes };
};

/** The rows of `ids` among `lines`; stops pulling lines once every id is found. */
export const collectRatings = async (lines: AsyncIterable<string>, ids: ReadonlySet<string>) => {
  const found = new Map<string, ImdbRating>();
  if (ids.size === 0) {
    return found;
  }
  for await (const line of lines) {
    const row = parseRatingLine(line);
    if (row && ids.has(row.tconst) && !found.has(row.tconst)) {
      found.set(row.tconst, { rating: row.rating, votes: row.votes });
      if (found.size === ids.size) {
        break;
      }
    }
  }
  return found;
};

export type ReadImdbRatingsOptions = {
  url?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

/**
 * Rating and votes for each of `ids` the file has; ids without a row are left out. One download,
 * gunzipped and split as it arrives, cut short once every id turned up. Network errors, a bad
 * status, a broken gzip or the timeout throw `ImdbRatingsUnavailable`.
 */
export const readImdbRatings = async (
  ids: ReadonlySet<string>,
  { url = IMDB_RATINGS_URL, timeoutMs = IMDB_RATINGS_TIMEOUT_MS, fetch: fetcher = fetch }: ReadImdbRatingsOptions = {},
): Promise<Map<string, ImdbRating>> => {
  if (ids.size === 0) {
    return new Map();
  }
  const signal = AbortSignal.timeout(timeoutMs);
  let response: Response;
  try {
    response = await fetcher(url, { signal, cache: "no-store" });
  } catch (error) {
    throw new ImdbRatingsUnavailable(signal.aborted ? "timeout" : `fetch ${messageOf(error)}`);
  }
  if (!response.ok || !response.body) {
    throw new ImdbRatingsUnavailable(`status ${response.status}`);
  }

  const source = Readable.fromWeb(response.body as unknown as NodeWebStream<Uint8Array>);
  const gunzip = createGunzip();
  const lines = createInterface({ input: source.pipe(gunzip), crlfDelay: Infinity });
  let failure: unknown = null;
  const fail = (error: unknown) => {
    failure ??= error;
    lines.close();
    gunzip.destroy();
  };
  source.on("error", fail);
  gunzip.on("error", fail);
  lines.on("error", fail);
  const onAbort = () => fail(new Error("timeout"));
  signal.addEventListener("abort", onAbort, { once: true });

  try {
    const found = await collectRatings(lines, ids);
    if (failure) {
      throw failure;
    }
    return found;
  } catch (error) {
    throw new ImdbRatingsUnavailable(signal.aborted ? "timeout" : `read ${messageOf(failure ?? error)}`);
  } finally {
    signal.removeEventListener("abort", onAbort);
    lines.close();
    source.destroy();
    gunzip.destroy();
  }
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
