import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { runPool } from "@/lib/run-pool";
import { computeTonightForUser } from "@/lib/tonight-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONCURRENCY = 4;

const isAuthorizedCron = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
};

/** Vercel Cron (after the providers refresh): precompute «Esta noche» for every user. */
export const GET = async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await db.query.users.findMany({ columns: { id: true } });
  let computed = 0;
  let failed = 0;

  await runPool(rows, CONCURRENCY, async (row) => {
    try {
      await computeTonightForUser(row.id);
      computed += 1;
    } catch {
      failed += 1;
    }
  });

  return NextResponse.json({ users: rows.length, computed, failed });
};
