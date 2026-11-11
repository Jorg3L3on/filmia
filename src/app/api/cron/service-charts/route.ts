import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { refreshServiceCharts } from "@/lib/service-charts-store";
import { isTmdbConfigured } from "@/lib/tmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** 28 discover calls, up to 280 Catalog upserts and the first night's enrichment. */
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
 * Vercel Cron (09:15 UTC, after watch-providers, before tonight-*): Hoy's second act (FIL-I47).
 * Stores the top 10 films and series per platform in MX into ServiceChart; Hoy only reads it.
 */
export const GET = async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isTmdbConfigured()) {
    return NextResponse.json({ error: "tmdb_not_configured" }, { status: 503 });
  }
  const charts = await refreshServiceCharts();
  return NextResponse.json({ charts });
};
