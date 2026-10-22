/**
 * How far the page must scroll so a ficha that just unfolded ends above the dock (FIL-I24-2).
 * Pure: the row measures itself and the dock, this only does the arithmetic.
 */
export type UnfoldRevealInput = {
  /** Top of the row in viewport px (before any scroll). */
  rowTop: number;
  /** Bottom of the row once fully unfolded, in viewport px. */
  rowBottom: number;
  /** Lowest allowed bottom: the dock's top minus the breathing room. */
  limitBottom: number;
  /** Highest allowed top: under the sticky header; a tall row keeps its head on screen. */
  minTop: number;
};

/** Scroll delta in px (0 when the unfolded row already fits above the dock). */
export const unfoldScrollDelta = ({ rowTop, rowBottom, limitBottom, minTop }: UnfoldRevealInput) => {
  const overflow = rowBottom - limitBottom;
  if (overflow <= 0) {
    return 0;
  }
  const headroom = Math.max(0, rowTop - minTop);
  return Math.round(Math.min(overflow, headroom));
};

/** Breathing room between the unfolded row and the dock. */
export const UNFOLD_DOCK_GAP_PX = 12;
/** Air kept between the sticky header and the row's top when the row is taller than the space. */
export const UNFOLD_HEADER_GAP_PX = 8;
