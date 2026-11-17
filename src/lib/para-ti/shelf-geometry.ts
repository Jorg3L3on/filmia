/**
 * The spine shelf's geometry (FIL-I60-5), pure. Each title is a box on a shelf: its spine faces
 * you; the one at the centre turns a quarter to show its cover. Positions come from the scroll
 * position only (`center` in slots, fractional while moving), so motion is tied to the finger,
 * not to a timer. Transforms and opacity only.
 */

export type ShelfDims = {
  /** Slot (spine) width, px: the scroll step. */
  slot: number;
  /** Cover width, px: the box's depth. */
  depth: number;
  /** Box height, px (2:3 cover). */
  height: number;
};

export const SHELF_PHONE: ShelfDims = { slot: 36, depth: 172, height: 258 };
export const SHELF_DESKTOP: ShelfDims = { slot: 50, depth: 236, height: 354 };

/** Titles mounted with their faces on each side of the centre: at most 2 × 12 + 1 = 25. */
export const SHELF_WINDOW = 12;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Smoothstep: the turn eases in and out around the centre. */
const ease = (t: number) => t * t * (3 - 2 * t);

export type SpinePose = {
  /** Quarter turn: 0 spine out, 1 cover facing you. */
  turn: number;
  /** Extra x so the turned cover pushes its neighbours aside, px. */
  shift: number;
  /** Toward the viewer, px. */
  z: number;
  rotateY: number;
  /** Lean with the shelf's speed, degrees (spines only). */
  lean: number;
  scale: number;
  opacity: number;
};

/**
 * Pose of the title at `distance` slots from the centre. `velocity` is slots per frame (signed);
 * `leanFactor` is the antojo's motion personality (0 still … 1.6 wild).
 */
export const spinePose = (distance: number, dims: ShelfDims, velocity = 0, leanFactor = 1): SpinePose => {
  const away = Math.abs(distance);
  const turn = ease(clamp(1 - away, 0, 1));
  const spread = (dims.depth - dims.slot) / 2 + 6;
  const shift = Math.sign(distance) * Math.min(away, 1) * spread;
  const lean = clamp(-velocity * 26 * leanFactor, -11, 11) * (1 - turn) || 0;
  return {
    turn,
    shift,
    z: turn * 60 - Math.min(away, 6) * 4,
    rotateY: -90 * turn,
    lean,
    scale: 1 + 0.08 * turn,
    opacity: away <= 8 ? 1 : clamp(1 - (away - 8) / 4, 0, 1),
  };
};

/** Perspective of the shelf, px. */
export const SHELF_PERSPECTIVE = 1100;

/**
 * The CSS transform of a box (applied inside its slot). The perspective is folded in, seen from
 * the shelf's centre (`originX` px from the box): one style write per box per frame, and every
 * box shares one vanishing point, so the side of a spine shows as it moves off centre.
 */
export const poseTransform = (pose: SpinePose, originX = 0) =>
  `translateX(${originX.toFixed(1)}px) perspective(${SHELF_PERSPECTIVE}px) translateX(${(-originX).toFixed(1)}px) translate3d(${pose.shift.toFixed(2)}px, 0, ${pose.z.toFixed(2)}px) rotateY(${pose.rotateY.toFixed(2)}deg) rotateZ(${pose.lean.toFixed(2)}deg) scale(${pose.scale.toFixed(4)})`;

/** Mount window centre, moved in steps of 4 so scrolling does not mount and unmount every slot. */
export const windowAnchor = (center: number) => Math.round(center / 4) * 4;

/** Which slot is at the centre for a scroll position (the track pads half the viewport each side). */
export const centerAt = (scrollLeft: number, dims: ShelfDims) => scrollLeft / dims.slot;

export const scrollFor = (index: number, dims: ShelfDims) => index * dims.slot;

/** Indices that get faces: a window around the centre. */
export const mountedRange = (center: number, count: number, window = SHELF_WINDOW) => {
  const middle = Math.round(center);
  return { from: Math.max(0, middle - window), to: Math.min(count - 1, middle + window) };
};

/** «Sorpréndeme»: seven times in ten from the top third, else anywhere; never the current one when there is a choice. */
export const surpriseIndex = (count: number, current: number, random: () => number = Math.random) => {
  if (count <= 1) return 0;
  const top = Math.max(1, Math.ceil(count / 3));
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const pick = random() < 0.7 ? Math.floor(random() * top) : Math.floor(random() * count);
    if (pick !== current) return pick;
  }
  return (current + 1) % count;
};
