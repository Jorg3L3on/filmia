import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveEstrenos } from "@/lib/juegos/estrenos/store";
import { sendJuegosPushes } from "@/lib/juegos/push-store";
import { isPushConfigured } from "@/lib/push/web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
 * Vercel Cron (15:00 UTC, 09:00 in Mexico City): Avisos de Juegos (FIL-I50-5). Daily so a launch
 * is news on its day; the tanda push goes at most once a week, and never two Juegos pushes a day.
 * It also resolves the Quiniela de estrenos (FIL-I55-1) before the pushes, with or without push
 * configured: a release without its IMDb rating yet simply waits for the next run.
 */
export const GET = async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const estrenos = await resolveEstrenos(now).catch((error: unknown) => ({ error: String(error) }));
  if (!isPushConfigured()) {
    return NextResponse.json({ estrenos, skipped: "push_not_configured" });
  }
  return NextResponse.json({ estrenos, ...(await sendJuegosPushes(now)) });
};
