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
    if (luma < 28 || luma > 230 || sat < 0.08) {
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

/** Lift / desaturate slightly so glow stays soft behind the hero. */
export const softenAmbientRgb = (rgb: AmbientRgb): AmbientRgb => {
  const lift = 18;
  const mix = 0.22;
  return {
    r: clampByte(rgb.r * (1 - mix) + (rgb.r + lift) * mix),
    g: clampByte(rgb.g * (1 - mix) + (rgb.g + lift) * mix),
    b: clampByte(rgb.b * (1 - mix) + (rgb.b + lift) * mix),
  };
};
