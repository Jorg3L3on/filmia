export const COVERFLOW_CARD_WIDTH = 340;
export const COVERFLOW_CARD_WIDTH_SHEET = 156;
export const COVERFLOW_CARD_WIDTH_MIN = 148;
export const COVERFLOW_CARD_WIDTH_SHEET_MIN = 112;
export const COVERFLOW_CARD_WIDTH_MAX_WIDE = 400;
export const COVERFLOW_CARD_WIDTH_CINEMATIC_MIN = 200;
export const COVERFLOW_CARD_WIDTH_CINEMATIC_MAX = 440;
export const COVERFLOW_DRAG_THRESHOLD = 6;
export const COVERFLOW_WHEEL_SENSITIVITY = 0.0044;
export const COVERFLOW_SNAP_LERP = 0.24;
export const COVERFLOW_COAST_FRICTION = 0.9;
export const COVERFLOW_COAST_MIN_VELOCITY = 0.003;
export const COVERFLOW_WHEEL_SNAP_MS = 70;
export const COVERFLOW_VISIBLE_SPAN = 5;
export const COVERFLOW_PAGE_POSTER_SIZES =
  "(max-width: 640px) 68vw, (max-width: 1024px) 42vw, 400px";
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
    const rotateCap = fittedRoom < 80 ? 40 : 56;

    return {
      rotateY: -side * Math.min(distance * 36, rotateCap),
      translateX: side * spread,
      translateZ: -Math.min(distance * 96, 260),
      translateY: isActive ? -2 : Math.min(distance * 2.4, 9),
      scale: 1 - Math.min(distance * 0.155, 0.34),
      brightness: Math.max(0.38, 1 - distance * 0.24),
      opacity: distance > 5.2 ? Math.max(0, 1 - (distance - 5.2) * 1.4) : 1,
      // Keep side blur modest — strong face blur composites over the hero in 3D.
      blur: isActive ? 0 : Math.min(distance * 2.1, 5.2),
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
  const isDestination = root.hasAttribute("data-coverflow-destination");
  // Continuum destination must clear the hero on phone — sit in the outer
  // side slot so genre + arrow + Desliza/Anterior read at arm's length.
  const room = Math.max(10, sideRoom);
  const destSign =
    Math.sign(offset) || Math.sign(metrics.translateX) || 1;
  // Compact dest card (~7.75rem): park it in the side gutter, not past the
  // viewport edge — otherwise only a sliver remains on-screen.
  const translateX = isDestination
    ? destSign *
      Math.max(Math.abs(metrics.translateX) * 1.7, room + 64)
    : metrics.translateX;
  const translateZ = isDestination
    ? Math.max(metrics.translateZ, -64)
    : metrics.translateZ;
  const rotateY = isDestination ? metrics.rotateY * 0.28 : metrics.rotateY;
  // Compact destination footprint is set in CSS; keep near-1 scale.
  const scale = isDestination ? Math.min(1, metrics.scale + 0.08) : metrics.scale;
  const zIndex = isDestination
    ? Math.max(metrics.zIndex, 860)
    : metrics.isActive
      ? Math.max(metrics.zIndex, 920)
      : metrics.zIndex;

  root.style.transform = `translate3d(${translateX}px, ${metrics.translateY}px, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
  root.style.opacity = String(metrics.opacity);
  root.style.zIndex = String(zIndex);
  root.style.pointerEvents = metrics.opacity < 0.08 ? "none" : "auto";
  root.style.willChange = moving ? "transform" : "auto";
  root.classList.toggle("is-focused", metrics.isActive);
  root.setAttribute("aria-selected", metrics.isActive ? "true" : "false");
  root.setAttribute("aria-hidden", metrics.opacity < 0.08 ? "true" : "false");

  if (face) {
    // Blur on the face (not the transformed root) so preserve-3d stays intact.
    // Focused hero + destination labels stay unblurred (overflow clips sides).
    const rawBlur =
      metrics.isActive || isDestination ? 0 : metrics.blur;
    const blurPx = prefersCoverflowReducedMotion()
      ? Math.min(rawBlur, 2.5) * 0.45
      : rawBlur;
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

  const maxWidth = cinematic
    ? stageWidth >= 900
      ? COVERFLOW_CARD_WIDTH_CINEMATIC_MAX
      : 360
    : stageWidth >= 900
      ? COVERFLOW_CARD_WIDTH_MAX_WIDE
      : COVERFLOW_CARD_WIDTH;
  // Qué ver: dominant hero (phone ~68vw). Historial keeps prior fill.
  const widthRatio = cinematic
    ? stageWidth >= 700
      ? 0.38
      : 0.56
    : stageWidth >= 700
      ? 0.4
      : 0.5;
  const widthBased = stageWidth * widthRatio;
  const heightBased =
    stageHeight > 0 ? stageHeight / 1.52 : Number.POSITIVE_INFINITY;
  const minWidth = cinematic
    ? Math.min(COVERFLOW_CARD_WIDTH_CINEMATIC_MIN, heightBased)
    : COVERFLOW_CARD_WIDTH_MIN;

  return Math.round(
    Math.min(maxWidth, Math.max(minWidth, Math.min(widthBased, heightBased))),
  );
};
