/** Sample a soft ambient RGB from poster pixels (Qué ver room glow). */

export type AmbientRgb = {
  r: number;
  g: number;
  b: number;
};

/** Fallback indigo matching `--accent` when sampling fails or poster is missing. */
export const AMBIENT_FALLBACK_RGB: AmbientRgb = { r: 124, g: 156, b: 255 };

export const clampByte = (value: number) =>
  Math.min(255, Math.max(0, Math.round(value)));

export const formatAmbientRgb = (rgb: AmbientRgb) =>
  `${clampByte(rgb.r)} ${clampByte(rgb.g)} ${clampByte(rgb.b)}`;

export const ambientCssVars = (rgb: AmbientRgb): Record<string, string> => ({
  "--que-ver-glow": formatAmbientRgb(rgb),
});

export const isAmbientFallback = (rgb: AmbientRgb) =>
  rgb.r === AMBIENT_FALLBACK_RGB.r &&
  rgb.g === AMBIENT_FALLBACK_RGB.g &&
  rgb.b === AMBIENT_FALLBACK_RGB.b;

type SampleOptions = {
  minLuma?: number;
  maxLuma?: number;
  minSat?: number;
};

const averageQualifying = (
  pixels: Uint8ClampedArray | Uint8Array,
  opts: SampleOptions,
): AmbientRgb | null => {
  const minLuma = opts.minLuma ?? 28;
  const maxLuma = opts.maxLuma ?? 230;
  const minSat = opts.minSat ?? 0.14;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const a = pixels[i + 3] ?? 255;
    if (a < 200) {
      continue;
    }

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const sat = max === 0 ? 0 : (max - min) / max;

    if (luma < minLuma || luma > maxLuma || sat < minSat) {
      continue;
    }

    sumR += r;
    sumG += g;
    sumB += b;
    count += 1;
  }

  if (count === 0) {
    return null;
  }

  return {
    r: clampByte(sumR / count),
    g: clampByte(sumG / count),
    b: clampByte(sumB / count),
  };
};

/**
 * Average saturated mid-tones from ImageData (skip near-black / near-white).
 * Pure helper — used by the client sampler and unit tests.
 * Tries a vivid pass first, then a more permissive chroma pass before fallback.
 */
export const sampleAmbientFromImageData = (
  data: ImageData,
  fallback: AmbientRgb = AMBIENT_FALLBACK_RGB,
): AmbientRgb => sampleAmbientFromRgba(data.data, fallback);

/**
 * Same sampler for raw RGBA buffers (sharp / canvas ImageData).
 * Never prefer dead gray — try harder before indigo.
 */
export const sampleAmbientFromRgba = (
  pixels: Uint8ClampedArray | Uint8Array,
  fallback: AmbientRgb = AMBIENT_FALLBACK_RGB,
): AmbientRgb => {
  const vivid = averageQualifying(pixels, {
    minSat: 0.14,
    minLuma: 28,
    maxLuma: 230,
  });
  if (vivid) {
    return vivid;
  }

  // Second pass: accept softer chroma / wider luma before giving up.
  const soft = averageQualifying(pixels, {
    minSat: 0.06,
    minLuma: 18,
    maxLuma: 245,
  });
  if (soft) {
    return soft;
  }

  // Last resort: any opaque non-near-black average (still better than flat indigo).
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const a = pixels[i + 3] ?? 255;
    if (a < 200) {
      continue;
    }
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (luma < 12 || luma > 250) {
      continue;
    }
    sumR += r;
    sumG += g;
    sumB += b;
    count += 1;
  }

  if (count === 0) {
    return fallback;
  }

  return {
    r: clampByte(sumR / count),
    g: clampByte(sumG / count),
    b: clampByte(sumB / count),
  };
};

/**
 * Boost saturation + luma so --que-ver-glow stays vivid behind the hero.
 * Avoids washed / dead-gray ambient that disappears on dark canvas.
 * Keeps poster hue identity (teal/gold) — only a tiny accent lift.
 */
export const softenAmbientRgb = (rgb: AmbientRgb): AmbientRgb => {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const sat = max === 0 ? 0 : (max - min) / max;

  // Near-gray sample → fall back to cinematic indigo instead of a dead puddle.
  if (sat < 0.08) {
    return { ...AMBIENT_FALLBACK_RGB };
  }

  const luma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  const satBoost = 1.55;
  const targetLuma = Math.max(luma * 1.22, 118);
  const mid = (rgb.r + rgb.g + rgb.b) / 3;

  let r = mid + (rgb.r - mid) * satBoost;
  let g = mid + (rgb.g - mid) * satBoost;
  let b = mid + (rgb.b - mid) * satBoost;

  const boostedLuma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (boostedLuma > 1) {
    const scale = targetLuma / boostedLuma;
    r *= scale;
    g *= scale;
    b *= scale;
  }

  // Tiny accent lift only when chroma is weak — strong teal/gold stay themselves.
  const accentMix = sat > 0.28 ? 0.04 : 0.1;
  r = r * (1 - accentMix) + AMBIENT_FALLBACK_RGB.r * accentMix;
  g = g * (1 - accentMix) + AMBIENT_FALLBACK_RGB.g * accentMix;
  b = b * (1 - accentMix) + AMBIENT_FALLBACK_RGB.b * accentMix;

  return {
    r: clampByte(r),
    g: clampByte(g),
    b: clampByte(b),
  };
};

/** Normalize a TMDB poster path for the ambient API (leading slash, no host). */
export const normalizePosterAmbientPath = (
  posterPath: string | null | undefined,
): string | null => {
  if (!posterPath) {
    return null;
  }
  const trimmed = posterPath.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const host = url.hostname;
      if (host !== "image.tmdb.org" && host !== "media.themoviedb.org") {
        return null;
      }
      const marker = "/t/p/";
      const idx = url.pathname.indexOf(marker);
      if (idx === -1) {
        return null;
      }
      const after = url.pathname.slice(idx + marker.length);
      const slash = after.indexOf("/");
      if (slash === -1) {
        return null;
      }
      const path = after.slice(slash);
      return path.startsWith("/") ? path : `/${path}`;
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith("/posters/")) {
    return trimmed;
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};
