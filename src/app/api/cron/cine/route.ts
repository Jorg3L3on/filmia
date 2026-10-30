import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { notifyCinemaArrivals } from "@/lib/cine-alerts-store";
import { notifyPremiereReminders } from "@/lib/cine-cuenta-store";
import { mxToday } from "@/lib/cine-core";
import { parseForceYear } from "@/lib/cine-top";
import { refreshYearTops } from "@/lib/cine-top-store";
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
 * MX cartelera into CinemaRelease (IMCINE dates on top, past releases weekly) and «Lo mejor del
 * año» into YearTop. The pages only ever read the tables.
 *
 * `?force=<año>` (FIL-I35-3, same secret) recomputes that year's top now, whatever its age, and
 * runs nothing else: the cartelera and its pushes keep their nightly turn.
 */
export const GET = async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const force = parseForceYear(new URL(request.url).searchParams.get("force"), mxToday());
  if (!force.ok) {
    return NextResponse.json({ error: "invalid_force" }, { status: 400 });
  }

  if (!isTmdbConfigured()) {
    return NextResponse.json({ error: "tmdb_not_configured" }, { status: 503 });
  }

  if (force.year != null) {
    const yearTop = await step(() => refreshYearTops(new Date(), undefined, { force: force.year }));
    return NextResponse.json({ force: force.year, yearTop });
  }

  const cartelera = await step(() => refreshCinemaReleases());
  const imcine = await step(() => applyImcineReleases());
  // After both date sources settled; a failed push pass must not turn the cron red.
  const alerts = await step(() => notifyCinemaArrivals());
  // «Avísame el día» (FIL-I26-5): today's premieres someone asked about.
  const premieres = await step(() => notifyPremiereReminders());
  const backfill = await step(async () =>
    (await shouldBackfill()) ? backfillPastReleases() : { ok: true as const, skipped: "not_due" },
  );
  const yearTop = await step(() => refreshYearTops());
  return NextResponse.json({ cartelera, imcine, alerts, premieres, backfill, yearTop });
};
