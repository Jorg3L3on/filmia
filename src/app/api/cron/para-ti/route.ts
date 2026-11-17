import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runParaTiRefresh } from "@/lib/para-ti/pool-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** A first fill is heavy (hundreds of new Catalog rows): the run stops starting pools at 230 s. */
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

/**
 * Vercel Cron (the last of the day, after «juegos»): refresh Para ti's shared pools (FIL-I60-2), stalest antojo × kind
 * first, with caps on new Catalog rows and TMDB calls; a short night resumes the next day.
 */
export const GET = async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const summary = await runParaTiRefresh();
  return NextResponse.json({
    antojosRefreshed: summary.refreshed,
    pools: summary.pools,
    skippedFresh: summary.skippedFresh,
    deferred: summary.deferred,
    failed: summary.failed,
    rowsWritten: summary.rowsWritten,
    newCatalogRows: summary.newCatalogRows,
    tmdbCalls: summary.tmdbCalls,
    order: summary.order,
    seconds: Math.round((Date.now() - startedAt) / 1000),
  });
};
