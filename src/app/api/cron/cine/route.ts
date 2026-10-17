import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { applyImcineReleases, backfillPastReleases, refreshCinemaReleases, shouldBackfill } from "@/lib/cine-store";
import { isTmdbConfigured } from "@/lib/tmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** ~150 TMDB detail calls plus the first night's enrichment: leave room. */
export const maxDuration = 300;

const isAuthorizedCron = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
};

const step = async <T>(run: () => Promise<T>) => {
  try {
    return await run();
  } catch {
    // Steps are independent: one failing must not cost the others their run.
    return { ok: false as const, error: "step_failed" };
  }
};

/**
 * Vercel Cron (10:00 UTC, after watch-providers / tonight-*): Cine (FIL-I17). Materializes the
 * MX cartelera into CinemaRelease; the pages only ever read the table.
 */
export const GET = async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isTmdbConfigured()) {
    return NextResponse.json({ error: "tmdb_not_configured" }, { status: 503 });
  }

  const cartelera = await step(() => refreshCinemaReleases());
  const imcine = await step(() => applyImcineReleases());
  const backfill = await step(async () =>
    (await shouldBackfill()) ? backfillPastReleases() : { ok: true as const, skipped: "not_due" },
  );
  return NextResponse.json({ cartelera, imcine, backfill });
};
