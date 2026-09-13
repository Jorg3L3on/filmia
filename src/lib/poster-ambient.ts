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

/**
 * Average saturated mid-tones from ImageData (skip near-black / near-white).
 * Pure helper — used by the client sampler and unit tests.
 */
export const sampleAmbientFromImageData = (
  data: ImageData,
  fallback: AmbientRgb = AMBIENT_FALLBACK_RGB,
): AmbientRgb => {
  const pixels = data.data;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const a = pixels[i + 3] ?? 0;
    if (a < 200) {
      continue;
    }

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const sat = max === 0 ? 0 : (max - min) / max;

    // Prefer mid-luma chroma so the spotlight reads cinematic, not muddy.
    // Raise sat floor vs #77 to skip dead gray (e.g. 118 121 120).
    if (luma < 28 || luma > 230 || sat < 0.14) {
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
 */
export const softenAmbientRgb = (rgb: AmbientRgb): AmbientRgb => {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const sat = max === 0 ? 0 : (max - min) / max;

  // Near-gray sample → fall back to cinematic indigo instead of a dead puddle.
  if (sat < 0.12) {
    return { ...AMBIENT_FALLBACK_RGB };
  }

  const luma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  const satBoost = 1.45;
  const targetLuma = Math.max(luma * 1.18, 110);
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

  // Small lift toward accent so cool/warm posters still read as glow, not mud.
  const accentMix = 0.12;
  r = r * (1 - accentMix) + AMBIENT_FALLBACK_RGB.r * accentMix;
  g = g * (1 - accentMix) + AMBIENT_FALLBACK_RGB.g * accentMix;
  b = b * (1 - accentMix) + AMBIENT_FALLBACK_RGB.b * accentMix;

  return {
    r: clampByte(r),
    g: clampByte(g),
    b: clampByte(b),
  };
};
