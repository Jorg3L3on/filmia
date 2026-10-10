import { timingSafeEqual } from "node:crypto";
import { max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, tonightRecos } from "@/db";
import { runPool } from "@/lib/run-pool";
import { computeRecosForUser } from "@/lib/tonight/reco-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Each user costs a few hundred TMDB calls the first time: leave room, stop starting new users early. */
export const maxDuration = 300;

const CONCURRENCY = 2;
const START_BUDGET_MS = 230_000;
const FRESH_MS = 12 * 60 * 60 * 1000;

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
 * Vercel Cron (after «tonight-picks»): rebuild every user's recommended pool. The stalest pool
 * goes first, so a night that runs out of time resumes where it stopped the next night.
 */
export const GET = async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const [users, pools] = await Promise.all([
    db.query.users.findMany({ columns: { id: true } }),
    db
      .select({ userId: tonightRecos.userId, computedAt: max(tonightRecos.computedAt) })
      .from(tonightRecos)
      .groupBy(tonightRecos.userId),
  ]);
  const computedAt = new Map(pools.map((row) => [row.userId, row.computedAt?.getTime() ?? 0]));
  const queue = users
    .map((row) => row.id)
    .sort((a, b) => (computedAt.get(a) ?? 0) - (computedAt.get(b) ?? 0));

  const summary = { users: queue.length, computed: 0, skipped: 0, deferred: 0, failed: 0, newCatalogRows: 0, picks: 0 };

  await runPool(queue, CONCURRENCY, async (userId) => {
    if (Date.now() - (computedAt.get(userId) ?? 0) < FRESH_MS) {
      summary.skipped += 1;
      return;
    }
    if (Date.now() - startedAt > START_BUDGET_MS) {
      summary.deferred += 1;
      return;
    }
    try {
      const result = await computeRecosForUser(userId);
      if (result.ok) {
        summary.computed += 1;
        summary.newCatalogRows += result.stats.materialized;
        summary.picks += result.picks.length;
      } else {
        summary.failed += 1;
      }
    } catch {
      summary.failed += 1;
    }
  });

  return NextResponse.json(summary);
};
