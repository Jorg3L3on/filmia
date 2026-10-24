/**
 * WCAG contrast of the cristal sala toast, composited the way the CSS paints it:
 * backdrop brightness(.62), then `--toast-fill` at .58, then the top sheen.
 * Text must clear 4.5:1 and controls / borders 3:1 on a light ground, a saturated
 * ground, poster-like grounds, and the solid fallbacks.
 */

type Rgb = [number, number, number];

const PAPER: Rgb = [240, 242, 244];
const SUBTITLE: Rgb = [231, 234, 238];
const ACCENT_TINT: Rgb = [255, 227, 216];
const FILL: Rgb = [14, 17, 22];
const CHIP: Rgb = [8, 10, 12];
const WHITE: Rgb = [255, 255, 255];

const lin = (channel: number) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const luminance = ([red, green, blue]: Rgb) => 0.2126 * lin(red) + 0.7152 * lin(green) + 0.0722 * lin(blue);

export const contrastRatio = (foreground: Rgb, background: Rgb) => {
  const lighter = luminance(foreground);
  const darker = luminance(background);
  const [high, low] = lighter > darker ? [lighter, darker] : [darker, lighter];
  return (high + 0.05) / (low + 0.05);
};

const over = (foreground: Rgb, background: Rgb, alpha: number): Rgb => [
  foreground[0] * alpha + background[0] * (1 - alpha),
  foreground[1] * alpha + background[1] * (1 - alpha),
  foreground[2] * alpha + background[2] * (1 - alpha),
];

/** Glass plate at the title, where the sheen is strongest (worst case for light type). */
export const glassPlate = (backdrop: Rgb, sheen = 0.13): Rgb => {
  const filtered = backdrop.map((channel) => channel * 0.62) as Rgb;
  const filled = over(FILL, filtered, 0.58);
  return over(WHITE, filled, sheen);
};

const solidPlate = (color: Rgb, alpha: number, backdrop: Rgb = WHITE): Rgb => over(color, backdrop, alpha);

export type ContrastSample = {
  surface: string;
  title: number;
  subtitle: number;
  action: number;
  close: number;
  edge: number;
  ring: number;
  icon: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

const GLYPHS: Rgb[] = [
  [138, 240, 189],
  [255, 255, 255],
  [255, 190, 160],
  [250, 220, 140],
  [255, 168, 176],
];

const sample = (surface: string, plate: Rgb): ContrastSample => {
  const chip = over(CHIP, plate, 0.92);
  const edge = over(WHITE, plate, 0.7);
  const ring = over(WHITE, chip, 0.78);
  const disc = over(CHIP, plate, 0.78);
  const icon = Math.min(...GLYPHS.map((glyph) => contrastRatio(glyph, disc)));
  return {
    surface,
    title: round(contrastRatio(PAPER, plate)),
    subtitle: round(contrastRatio(SUBTITLE, plate)),
    action: round(contrastRatio(ACCENT_TINT, chip)),
    close: round(contrastRatio(PAPER, plate)),
    edge: round(contrastRatio(edge, plate)),
    ring: round(Math.min(contrastRatio(ring, chip), contrastRatio(ring, plate))),
    icon: round(icon),
  };
};

export const toastContrastSamples = (): ContrastSample[] => [
  sample("Blanco + velo", glassPlate(WHITE, 0.13)),
  sample("Saturado", glassPlate([230, 50, 80], 0.13)),
  sample("Póster cálido", glassPlate([240, 200, 80], 0.13)),
  sample("Póster noche", glassPlate([16, 22, 40], 0.13)),
  sample("Sólido (sin filtro / reducir transparencia)", solidPlate([24, 28, 35], 0.97)),
  sample("Aumentar contraste", solidPlate([10, 12, 15], 0.97)),
];

export const TOAST_SUBTITLE = "#e7eaee";
export const TOAST_TITLE = "#f0f2f4";
