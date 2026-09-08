export const COVERFLOW_CARD_WIDTH = 236;
export const COVERFLOW_CARD_WIDTH_SHEET = 156;
export const COVERFLOW_CARD_WIDTH_MIN = 128;
export const COVERFLOW_CARD_WIDTH_SHEET_MIN = 112;
export const COVERFLOW_DRAG_THRESHOLD = 6;
export const COVERFLOW_WHEEL_SENSITIVITY = 0.0044;
export const COVERFLOW_SNAP_LERP = 0.24;
export const COVERFLOW_COAST_FRICTION = 0.9;
export const COVERFLOW_COAST_MIN_VELOCITY = 0.003;
export const COVERFLOW_WHEEL_SNAP_MS = 70;
export const COVERFLOW_VISIBLE_SPAN = 5;
export const COVERFLOW_PAGE_POSTER_SIZES = "(max-width: 640px) 46vw, 236px";
export const COVERFLOW_SHEET_POSTER_SIZES = "(max-width: 640px) 36vw, 156px";

export type CoverflowCardMetrics = {
  rotateY: number;
  translateX: number;
  translateZ: number;
  translateY: number;
  scale: number;
  brightness: number;
  opacity: number;
  zIndex: number;
  isActive: boolean;
};

export type CoverflowPaintedCard = {
  root: HTMLElement;
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
): CoverflowCardMetrics => {
  const distance = Math.abs(offset);
  const side = Math.sign(offset) || 0;
  const isActive = distance < 0.45;
  const fittedRoom = Math.max(10, sideRoom);
  const spread = fittedRoom * (1 - Math.exp(-distance * (compact ? 0.86 : 0.72)));
  const rotateCap = compact ? 22 : fittedRoom < 90 ? 14 : 26;

  return {
    rotateY: -side * Math.min(distance * (compact ? 11 : 7.5), rotateCap),
    translateX: side * spread,
    translateZ: -Math.min(distance * (compact ? 22 : 14), compact ? 64 : 48),
    translateY: isActive ? -6 : Math.min(distance * (compact ? 6 : 3), compact ? 16 : 10),
    scale: 1 - Math.min(distance * (compact ? 0.12 : 0.015), compact ? 0.28 : 0.05),
    brightness: Math.max(compact ? 0.62 : 0.72, 1 - distance * (compact ? 0.14 : 0.08)),
    opacity: distance > 5.2 ? Math.max(0, 1 - (distance - 5.2) * 1.4) : 1,
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
) => {
  const metrics = getCoverflowCardMetrics(offset, sideRoom, compact);
  const { root, dim, caption, link } = node;

  root.style.transform = `translate3d(${metrics.translateX}px, ${metrics.translateY}px, ${metrics.translateZ}px) rotateY(${metrics.rotateY}deg) scale(${metrics.scale})`;
  root.style.opacity = String(metrics.opacity);
  root.style.zIndex = String(metrics.zIndex);
  root.style.pointerEvents = metrics.opacity < 0.08 ? "none" : "auto";
  root.style.willChange = moving ? "transform" : "auto";
  root.classList.toggle("is-focused", metrics.isActive);
  root.setAttribute("aria-selected", metrics.isActive ? "true" : "false");
  root.setAttribute("aria-hidden", metrics.opacity < 0.08 ? "true" : "false");

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
) => {
  const maxWidth = compact ? COVERFLOW_CARD_WIDTH_SHEET : COVERFLOW_CARD_WIDTH;
  const minWidth = compact ? COVERFLOW_CARD_WIDTH_SHEET_MIN : COVERFLOW_CARD_WIDTH_MIN;
  return Math.round(
    Math.min(maxWidth, Math.max(minWidth, stageWidth * (compact ? 0.36 : 0.46))),
  );
};
