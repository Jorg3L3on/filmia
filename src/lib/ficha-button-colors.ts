import { parseAmbientRgb, type AmbientRgb } from "@/lib/poster-ambient";

/**
 * The ficha's primary button in the poster's two colors (FIL-I46-2). From `Catalog.posterAmbient`
 * («r g b») it derives a light stop and a hue-shifted second stop, then keeps the ink text
 * (as on the orange) only when it reaches 4.5:1 (WCAG AA) against both stops. Otherwise null: the orange stays.
 */

export const MIN_BUTTON_CONTRAST = 4.5;

const INK: AmbientRgb = { r: 14, g: 17, b: 20 };

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = ({ r, g, b }: AmbientRgb) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export const contrastRatio = (a: AmbientRgb, b: AmbientRgb) => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

type Hsl = { h: number; s: number; l: number };

const toHsl = ({ r, g, b }: AmbientRgb): Hsl => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) {
    return { h: 0, s: 0, l };
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rn ? ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6 : max === gn ? ((bn - rn) / d + 2) / 6 : ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
};

const toRgb = ({ h, s, l }: Hsl): AmbientRgb => {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return { r: Math.round(f(hue + 1 / 3) * 255), g: Math.round(f(hue) * 255), b: Math.round(f(hue - 1 / 3) * 255) };
};

const css = ({ r, g, b }: AmbientRgb) => `rgb(${r} ${g} ${b})`;

export type FichaButtonColors = { from: string; to: string; text: "ink"; contrast: number };

/** Below this saturation the poster is grey: a grey button reads as disabled, keep the orange. */
const MIN_SATURATION = 0.18;

export const fichaButtonColors = (posterAmbient: string | null | undefined): FichaButtonColors | null => {
  const rgb = parseAmbientRgb(posterAmbient);
  if (!rgb) {
    return null;
  }
  const base = toHsl(rgb);
  if (base.s < MIN_SATURATION) {
    return null;
  }
  const s = Math.min(0.85, Math.max(0.45, base.s));
  // Dark hues (blue, violet) need more light before ink text reads: step the light up, never past
  // a pastel that would lose the poster's color.
  for (let l = 0.58; l <= 0.78 + 1e-9; l += 0.04) {
    const from = toRgb({ h: base.h, s, l: l + 0.06 });
    const to = toRgb({ h: base.h + 28, s, l });
    const contrast = Math.min(contrastRatio(INK, from), contrastRatio(INK, to));
    if (contrast >= MIN_BUTTON_CONTRAST) {
      return { from: css(from), to: css(to), text: "ink", contrast };
    }
  }
  return null;
};

/** For tests: the stops as numbers. */
export const parseCssRgb = (value: string): AmbientRgb => {
  const [r, g, b] = value.replace(/[^\d ]/g, "").trim().split(/\s+/).map(Number);
  return { r: r ?? 0, g: g ?? 0, b: b ?? 0 };
};
