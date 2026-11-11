import type { TitleKind } from "@/db";
import type { CatalogEnrichmentPatch } from "@/lib/catalog-enrich-core";
import { TmdbRequestError } from "@/lib/tmdb";

/** One TMDB details call per row, in groups, so a full catalog pass stays paced. */
export const TITLE_BACKFILL_BATCH_SIZE = 20;
/** First waits use `Retry-After`; after this many 429s the run stops. */
export const TITLE_BACKFILL_MAX_ATTEMPTS = 5;

export type CatalogTitleRow = {
  id: string;
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName: string | null;
  alternateNames: string[];
};

export type TitleBackfillStats = {
  updated: number;
  unchanged: number;
  failed: number;
  batches: number;
};

const sameList = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

/** True when the enrich patch would change the stored Mexican name, original, or search strings. */
export const titlePatchChangesRow = (row: CatalogTitleRow, patch: CatalogEnrichmentPatch) => {
  const alternateNames = patch.alternateNames ?? row.alternateNames;
  return (
    (patch.name != null && patch.name !== row.name) ||
    (patch.originalName != null && patch.originalName !== row.originalName) ||
    !sameList(alternateNames, row.alternateNames)
  );
};

/**
 * Honor TMDB's `Retry-After` when it sent one. Otherwise back off 1s, 2s, 4s…
 * capped at 30s. `attempt` is how many 429s this row has already seen.
 */
export const rateLimitDelayMs = (attempt: number, retryAfterSeconds: number | null) => {
  if (retryAfterSeconds != null && Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(Math.round(retryAfterSeconds * 1000), 60_000);
  }
  return Math.min(1000 * 2 ** Math.max(0, attempt), 30_000);
};

export const chunkRows = <T>(items: readonly T[], size: number): T[][] => {
  const batchSize = Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
};

/** Local Postgres only, unless the caller passes an explicit remote override. */
export const allowsTitleBackfill = (databaseUrl: string, allowRemote: boolean) => {
  if (allowRemote) {
    return true;
  }
  try {
    const host = new URL(databaseUrl).hostname.replace(/^\[|\]$/g, "");
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
};

const rateLimitOf = (error: unknown) => {
  if (error instanceof TmdbRequestError && error.code === "rate_limit") {
    return error.retryAfterSeconds;
  }
  return undefined;
};

/**
 * Walk the catalog in batches through the same title patch enrichment writes.
 * `--dry-run` resolves titles and never calls `write`. A 429 waits for
 * `Retry-After` (or the backoff) and retries that row; once the attempts run
 * out, the error propagates so the pass stops instead of hammering TMDB.
 */
export const runCatalogTitleBackfill = async ({
  rows,
  batchSize,
  dryRun,
  pauseMs,
  resolve,
  write,
  sleep,
  log = () => {},
}: {
  rows: readonly CatalogTitleRow[];
  batchSize: number;
  dryRun: boolean;
  pauseMs: number;
  resolve: (row: CatalogTitleRow) => Promise<CatalogEnrichmentPatch>;
  write: (row: CatalogTitleRow, patch: CatalogEnrichmentPatch) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  log?: (line: string) => void;
}): Promise<TitleBackfillStats> => {
  const batches = chunkRows(rows, batchSize);
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const [batchIndex, batch] of batches.entries()) {
    for (const [index, row] of batch.entries()) {
      let attempt = 0;
      while (true) {
        try {
          const patch = await resolve(row);
          if (!titlePatchChangesRow(row, patch)) {
            unchanged += 1;
            log(`· ${row.name}: sin cambios`);
          } else if (dryRun) {
            updated += 1;
            log(`· ${row.name}: se escribiría «${patch.name ?? row.name}»`);
          } else {
            await write(row, patch);
            updated += 1;
            log(`✓ ${row.name}`);
          }
          break;
        } catch (error) {
          const retryAfterSeconds = rateLimitOf(error);
          if (retryAfterSeconds !== undefined && attempt < TITLE_BACKFILL_MAX_ATTEMPTS - 1) {
            const delay = rateLimitDelayMs(attempt, retryAfterSeconds);
            log(`429 en ${row.name}: espera ${delay} ms`);
            await sleep(delay);
            attempt += 1;
            continue;
          }
          failed += 1;
          log(`✗ ${row.name}: ${error instanceof Error ? error.message : "desconocido"}`);
          if (retryAfterSeconds !== undefined) {
            throw error;
          }
          break;
        }
      }

      const more = index < batch.length - 1 || batchIndex < batches.length - 1;
      if (more && pauseMs > 0) {
        await sleep(pauseMs);
      }
    }
  }

  return { updated, unchanged, failed, batches: batches.length };
};
