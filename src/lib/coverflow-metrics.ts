export const COVERFLOW_CARD_WIDTH = 340;
export const COVERFLOW_CARD_WIDTH_SHEET = 156;
export const COVERFLOW_CARD_WIDTH_MIN = 148;
export const COVERFLOW_CARD_WIDTH_SHEET_MIN = 112;
export const COVERFLOW_CARD_WIDTH_MAX_WIDE = 400;
export const COVERFLOW_CARD_WIDTH_CINEMATIC_MIN = 200;
export const COVERFLOW_CARD_WIDTH_CINEMATIC_MAX = 440;
export const COVERFLOW_DRAG_THRESHOLD = 6;
export const COVERFLOW_WHEEL_SENSITIVITY = 0.0044;
/**
 * Critically damped settle (rad/s): eases in instead of jolting and rests in ~0.43 s
 * (26 frames at 60 Hz), no more frames than the old 0.24-per-frame lerp.
 */
export const COVERFLOW_SPRING_OMEGA = 20;
/** At rest below half a pixel of travel (~215 px per card at the hero). */
export const COVERFLOW_SPRING_REST_OFFSET = 0.002;
export const COVERFLOW_SPRING_REST_VELOCITY = 0.05;
/** Per 60 Hz frame; scaled by real frame time so 120 Hz coasts the same. */
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
  /** Last values written, so a frame only touches what changed (no same-value writes). */
  painted?: Record<string, string | number | boolean>;
};

let reducedMotionQuery: MediaQueryList | null = null;

/** Read every painted frame: one cached MediaQueryList, not a new one per card per frame. */
export const prefersCoverflowReducedMotion = () => {
  if (typeof window === "undefined") {
    return false;
  }
  reducedMotionQuery ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return reducedMotionQuery.matches;
};

export const clampCoverflowIndex = (value: number, max: number) =>
  Math.min(Math.max(value, 0), Math.max(max, 0));

/**
 * One step of a critically damped spring toward 0, in closed form: the same
 * elapsed time lands in the same place whatever the frame rate.
 * `offset` is position − target (cards); `velocity` is cards per second.
 */
export const stepCoverflowSpring = (
  offset: number,
  velocity: number,
  dtSeconds: number,
  omega = COVERFLOW_SPRING_OMEGA,
) => {
  const decay = Math.exp(-omega * dtSeconds);
  const c = velocity + omega * offset;
  return {
    offset: (offset + c * dtSeconds) * decay,
    velocity: (velocity - omega * c * dtSeconds) * decay,
  };
};

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

const setAttributeIfChanged = (node: HTMLElement, name: string, value: string) => {
  if (node.getAttribute(name) !== value) {
    node.setAttribute(name, value);
  }
};

/** Side-card blur moves in half-pixel steps: a few re-filters per card per move, not one a frame. */
export const quantizeCoverflowBlur = (blurPx: number) => Math.round(blurPx * 2) / 2;

export const paintCoverflowCard = (
  node: CoverflowPaintedCard,
  offset: number,
  sideRoom: number,
  compact: boolean,
  moving: boolean,
  cinematic = false,
  lite = false,
) => {
  const metrics = getCoverflowCardMetrics(offset, sideRoom, compact, cinematic);
  const { root, face, dim, caption, link } = node;
  const { translateX, translateZ, rotateY, scale } = metrics;
  const zIndex = metrics.isActive ? Math.max(metrics.zIndex, 920) : metrics.zIndex;
  const hidden = metrics.opacity < 0.08;
  const painted = (node.painted ??= {});
  const write = (key: string, value: string | number | boolean, apply: () => void) => {
    if (painted[key] !== value) {
      painted[key] = value;
      apply();
    }
  };

  const transform = `translate3d(${translateX.toFixed(1)}px, ${metrics.translateY.toFixed(1)}px, ${translateZ.toFixed(1)}px) rotateY(${rotateY.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
  write("transform", transform, () => (root.style.transform = transform));
  const opacity = String(metrics.opacity);
  write("opacity", opacity, () => (root.style.opacity = opacity));
  write("zIndex", zIndex, () => (root.style.zIndex = String(zIndex)));
  write("pointerEvents", hidden, () => (root.style.pointerEvents = hidden ? "none" : "auto"));
  write("moving", moving, () => (root.style.willChange = moving ? "transform" : "auto"));
  // React also renders the class, aria-selected and the link's tabIndex (and may reset
  // them on a re-render): compare with the DOM itself, not the cache.
  if (root.classList.contains("is-focused") !== metrics.isActive) {
    root.classList.toggle("is-focused", metrics.isActive);
  }
  setAttributeIfChanged(root, "aria-selected", metrics.isActive ? "true" : "false");
  setAttributeIfChanged(root, "aria-hidden", hidden ? "true" : "false");
  const tabIndex = metrics.isActive ? 0 : -1;
  if (link && link.tabIndex !== tabIndex) {
    link.tabIndex = tabIndex;
  }

  if (face) {
    // Blur on the face (not the transformed root) so preserve-3d stays intact.
    // Focused hero stays unblurred (overflow clips sides). Lite: no blur at all.
    const rawBlur = metrics.isActive || lite ? 0 : metrics.blur;
    const blurPx = quantizeCoverflowBlur(
      prefersCoverflowReducedMotion() ? Math.min(rawBlur, 2.5) * 0.45 : rawBlur,
    );
    const filter = blurPx > 0 ? `blur(${blurPx}px)` : "none";
    write("filter", filter, () => (face.style.filter = filter));
  }

  if (dim) {
    const dimOpacity = (1 - metrics.brightness).toFixed(2);
    write("dim", dimOpacity, () => (dim.style.opacity = dimOpacity));
  }

  if (caption) {
    const captionOpacity = !compact && Math.abs(offset) < 3.2 ? "1" : "0";
    write("caption", captionOpacity, () => (caption.style.opacity = captionOpacity));
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
  // Esta noche: dominant hero (phone ~62% of the stage). Historial keeps prior fill.
  const widthRatio = cinematic
    ? stageWidth >= 700
      ? 0.38
      : 0.62
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
