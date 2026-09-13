export const COVERFLOW_CARD_WIDTH = 340;
export const COVERFLOW_CARD_WIDTH_SHEET = 156;
export const COVERFLOW_CARD_WIDTH_MIN = 148;
export const COVERFLOW_CARD_WIDTH_SHEET_MIN = 112;
export const COVERFLOW_CARD_WIDTH_MAX_WIDE = 400;
export const COVERFLOW_DRAG_THRESHOLD = 6;
export const COVERFLOW_WHEEL_SENSITIVITY = 0.0044;
export const COVERFLOW_SNAP_LERP = 0.24;
export const COVERFLOW_COAST_FRICTION = 0.9;
export const COVERFLOW_COAST_MIN_VELOCITY = 0.003;
export const COVERFLOW_WHEEL_SNAP_MS = 70;
export const COVERFLOW_VISIBLE_SPAN = 5;
export const COVERFLOW_PAGE_POSTER_SIZES =
  "(max-width: 640px) 52vw, (max-width: 1024px) 36vw, 340px";
export const COVERFLOW_SHEET_POSTER_SIZES = "(max-width: 640px) 36vw, 156px";

export type CoverflowCardMetrics = {
  rotateY: number;
  translateX: number;
  translateZ: number;
  translateY: number;
  scale: number;
  brightness: number;
  opacity: number;
  blur: number;
  zIndex: number;
  isActive: boolean;
};

export type CoverflowPaintedCard = {
  root: HTMLElement;
  face: HTMLElement | null;
  dim: HTMLElement | null;
  caption: HTMLElement | null;
  link: HTMLElement | null;
};

export const prefersCoverflowReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const clampCoverflowIndex = (value: number, max: number) =>
  Math.min(Math.max(value, 0), Math.max(max, 0));

export const getCoverflowCardMetrics = (
  offset: number,
  sideRoom: number,
  compact = false,
  cinematic = false,
): CoverflowCardMetrics => {
  const distance = Math.abs(offset);
  const side = Math.sign(offset) || 0;
  const isActive = distance < 0.45;
  const fittedRoom = Math.max(10, sideRoom);

  if (cinematic) {
    // Soft floating L+R fan: neighbors on both sides rotateY toward center,
    // scale down, translateZ back, blur + dim (JOR-221 soft-coverflow).
    const spread =
      fittedRoom * (1 - Math.exp(-distance * 1.12)) * (fittedRoom < 70 ? 1.15 : 1.28);
    const rotateCap = fittedRoom < 80 ? 30 : 46;

    return {
      rotateY: -side * Math.min(distance * 15.5, rotateCap),
      translateX: side * spread,
      translateZ: -Math.min(distance * 52, 168),
      translateY: isActive ? -2 : Math.min(distance * 2.4, 9),
      scale: 1 - Math.min(distance * 0.09, 0.24),
      brightness: Math.max(0.38, 1 - distance * 0.24),
      opacity: distance > 5.2 ? Math.max(0, 1 - (distance - 5.2) * 1.4) : 1,
      blur: isActive ? 0 : Math.min(distance * 3.8, 9),
      zIndex: Math.round(900 - distance * 80),
      isActive,
    };
  }

  const spread = fittedRoom * (1 - Math.exp(-distance * (compact ? 0.86 : 0.78)));
  const rotateCap = compact ? 22 : fittedRoom < 90 ? 18 : 32;

  return {
    rotateY: -side * Math.min(distance * (compact ? 11 : 9.5), rotateCap),
    translateX: side * spread,
    translateZ: -Math.min(distance * (compact ? 22 : 22), compact ? 64 : 72),
    translateY: isActive ? -8 : Math.min(distance * (compact ? 6 : 4), compact ? 16 : 14),
    scale: 1 - Math.min(distance * (compact ? 0.12 : 0.055), compact ? 0.28 : 0.14),
    brightness: Math.max(compact ? 0.62 : 0.55, 1 - distance * (compact ? 0.14 : 0.16)),
    opacity: distance > 5.2 ? Math.max(0, 1 - (distance - 5.2) * 1.4) : 1,
    blur: 0,
    zIndex: Math.round(900 - distance * 80),
    isActive,
  };
};

export const paintCoverflowCard = (
  node: CoverflowPaintedCard,
  offset: number,
  sideRoom: number,
  compact: boolean,
  moving: boolean,
  cinematic = false,
) => {
  const metrics = getCoverflowCardMetrics(offset, sideRoom, compact, cinematic);
  const { root, face, dim, caption, link } = node;

  root.style.transform = `translate3d(${metrics.translateX}px, ${metrics.translateY}px, ${metrics.translateZ}px) rotateY(${metrics.rotateY}deg) scale(${metrics.scale})`;
  root.style.opacity = String(metrics.opacity);
  root.style.zIndex = String(metrics.zIndex);
  root.style.pointerEvents = metrics.opacity < 0.08 ? "none" : "auto";
  root.style.willChange = moving ? "transform" : "auto";
  root.classList.toggle("is-focused", metrics.isActive);
  root.setAttribute("aria-selected", metrics.isActive ? "true" : "false");
  root.setAttribute("aria-hidden", metrics.opacity < 0.08 ? "true" : "false");

  if (face) {
    // Blur on the face (not the transformed root) so preserve-3d stays intact.
    const blurPx = prefersCoverflowReducedMotion()
      ? Math.min(metrics.blur, 2.5) * 0.45
      : metrics.blur;
    face.style.filter = blurPx > 0.04 ? `blur(${blurPx.toFixed(2)}px)` : "none";
  }

  if (dim) {
    dim.style.opacity = String(1 - metrics.brightness);
  }

  if (caption) {
    caption.style.opacity = !compact && Math.abs(offset) < 3.2 ? "1" : "0";
  }

  if (link) {
    link.tabIndex = metrics.isActive ? 0 : -1;
  }
};

export const measureCoverflowCardWidth = (
  stageWidth: number,
  compact: boolean,
  stageHeight = 0,
  cinematic = false,
) => {
  if (compact) {
    return Math.round(
      Math.min(
        COVERFLOW_CARD_WIDTH_SHEET,
        Math.max(COVERFLOW_CARD_WIDTH_SHEET_MIN, stageWidth * 0.36),
      ),
    );
  }

  const maxWidth =
    stageWidth >= 900 ? COVERFLOW_CARD_WIDTH_MAX_WIDE : COVERFLOW_CARD_WIDTH;
  // Soft-coverflow leaves more lateral room for a true L+R fan; historial keeps prior fill.
  const widthRatio = cinematic
    ? stageWidth >= 700
      ? 0.34
      : 0.46
    : stageWidth >= 700
      ? 0.4
      : 0.5;
  const widthBased = stageWidth * widthRatio;
  const heightBased =
    stageHeight > 0 ? stageHeight / 1.52 : Number.POSITIVE_INFINITY;

  return Math.round(
    Math.min(maxWidth, Math.max(COVERFLOW_CARD_WIDTH_MIN, Math.min(widthBased, heightBased))),
  );
};
