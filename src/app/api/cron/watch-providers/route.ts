import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isTmdbConfigured } from "@/lib/tmdb";
import { refreshStaleWatchProviders } from "@/lib/watch-providers-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isAuthorizedCron = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
};

/** Vercel Cron: keeps «Disponible en MX» current without anyone opening each ficha. */
export const GET = async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isTmdbConfigured()) {
    return NextResponse.json({ error: "tmdb_not_configured" }, { status: 503 });
  }

  const summary = await refreshStaleWatchProviders();
  return NextResponse.json(summary);
};
