import { NextResponse } from "next/server";
import {
  AMBIENT_FALLBACK_RGB,
  formatAmbientRgb,
} from "@/lib/poster-ambient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cacheControl =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

const fallbackJson = (fallback = true) =>
  NextResponse.json(
    {
      r: AMBIENT_FALLBACK_RGB.r,
      g: AMBIENT_FALLBACK_RGB.g,
      b: AMBIENT_FALLBACK_RGB.b,
      css: formatAmbientRgb(AMBIENT_FALLBACK_RGB),
      fallback,
    },
    {
      status: 200,
      headers: { "Cache-Control": cacheControl },
    },
  );

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const rawPath = url.searchParams.get("path");

  if (!rawPath) {
    return fallbackJson(true);
  }

  try {
    const { sampleAmbientFromPosterPath } = await import(
      "@/lib/poster-ambient-server"
    );
    const rgb = await sampleAmbientFromPosterPath(rawPath);
    const fallback =
      rgb.r === AMBIENT_FALLBACK_RGB.r &&
      rgb.g === AMBIENT_FALLBACK_RGB.g &&
      rgb.b === AMBIENT_FALLBACK_RGB.b;

    return NextResponse.json(
      {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        css: formatAmbientRgb(rgb),
        fallback,
      },
      {
        status: 200,
        headers: { "Cache-Control": cacheControl },
      },
    );
  } catch {
    return fallbackJson(true);
  }
};
