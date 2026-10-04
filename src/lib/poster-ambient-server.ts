/** Server-only poster ambient sampling (sharp + TMDB fetch). */

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  AMBIENT_FALLBACK_RGB,
  normalizePosterAmbientPath,
  sampleAmbientFromRgba,
  softenAmbientRgb,
  type AmbientRgb,
} from "@/lib/poster-ambient";

const SAMPLE_SIZE = 32;
const TMDB_POSTER_HOST = "https://image.tmdb.org/t/p/w185";

const isSafeLocalPoster = (posterPath: string) => {
  if (!posterPath.startsWith("/posters/")) {
    return false;
  }
  if (posterPath.includes("..") || posterPath.includes("\\")) {
    return false;
  }
  return /^\/posters\/[A-Za-z0-9._-]+$/.test(posterPath);
};

const isSafeTmdbPosterPath = (posterPath: string) =>
  /^\/[A-Za-z0-9_./-]+\.(jpg|jpeg|png|webp)$/i.test(posterPath) &&
  !posterPath.includes("..");

export const resolvePosterAmbientSource = (
  rawPath: string | null | undefined,
): { kind: "tmdb" | "local"; path: string } | null => {
  const normalized = normalizePosterAmbientPath(rawPath);
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("/posters/")) {
    return isSafeLocalPoster(normalized)
      ? { kind: "local", path: normalized }
      : null;
  }
  return isSafeTmdbPosterPath(normalized)
    ? { kind: "tmdb", path: normalized }
    : null;
};

const loadPosterBytes = async (
  source: { kind: "tmdb" | "local"; path: string },
): Promise<Buffer | null> => {
  if (source.kind === "local") {
    const filePath = path.join(process.cwd(), "public", source.path.slice(1));
    try {
      return await readFile(filePath);
    } catch {
      return null;
    }
  }

  try {
    const response = await fetch(`${TMDB_POSTER_HOST}${source.path}`, {
      headers: { Accept: "image/*" },
      cache: "force-cache",
    });
    if (!response.ok) {
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length > 0 ? buffer : null;
  } catch {
    return null;
  }
};

export const sampleAmbientFromPosterPath = async (
  rawPath: string | null | undefined,
): Promise<AmbientRgb> => {
  const source = resolvePosterAmbientSource(rawPath);
  if (!source) {
    return { ...AMBIENT_FALLBACK_RGB };
  }

  const bytes = await loadPosterBytes(source);
  if (!bytes) {
    return { ...AMBIENT_FALLBACK_RGB };
  }

  try {
    const { data, info } = await sharp(bytes)
      .rotate()
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "cover" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.channels < 3) {
      return { ...AMBIENT_FALLBACK_RGB };
    }

    // Ensure RGBA stride for the shared sampler.
    let rgba: Uint8Array = data;
    if (info.channels === 3) {
      const next = new Uint8Array((data.length / 3) * 4);
      for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
        next[j] = data[i] ?? 0;
        next[j + 1] = data[i + 1] ?? 0;
        next[j + 2] = data[i + 2] ?? 0;
        next[j + 3] = 255;
      }
      rgba = next;
    }

    return softenAmbientRgb(sampleAmbientFromRgba(rgba));
  } catch {
    return { ...AMBIENT_FALLBACK_RGB };
  }
};
