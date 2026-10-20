import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runMcpRetention } from "@/lib/mcp-retention";
import { notifyPlatformArrivals } from "@/lib/platform-arrivals-store";
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

/**
 * Vercel Cron: keeps «Disponible en MX» current without anyone opening each ficha, then
 * pushes «Llegó a tu plataforma» for the Quiero ver titles that just arrived (FIL-I12). Also the
 * MCP connector's daily cleanup (FIL-I20), which needs no TMDB.
 */
export const GET = async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let mcpRetention: Awaited<ReturnType<typeof runMcpRetention>> | { error: string };
  try {
    mcpRetention = await runMcpRetention();
  } catch {
    mcpRetention = { error: "mcp_retention_failed" };
  }

  if (!isTmdbConfigured()) {
    return NextResponse.json({ error: "tmdb_not_configured", mcpRetention }, { status: 503 });
  }

  const summary = await refreshStaleWatchProviders();
  let alerts: Awaited<ReturnType<typeof notifyPlatformArrivals>> | { error: string };
  try {
    alerts = await notifyPlatformArrivals();
  } catch {
    // The refresh already landed; a failed push pass must not turn the cron red.
    alerts = { error: "platform_alerts_failed" };
  }
  return NextResponse.json({ ...summary, alerts, mcpRetention });
};
