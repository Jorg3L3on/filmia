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

/**
 * Scroll the page so a row that just unfolded ends above the dock (FIL-I24-2). The unfold is a
 * 420 ms transition, so the final height is measured first with transitions off (the row is
 * rewound to its folded values and released again, like FLIP), and the page scrolls alongside.
 */
export const revealUnfoldedRow = (row: HTMLLIElement) => {
  const detail = row.querySelector<HTMLElement>(".ficha-detail");
  const poster = row.querySelector<HTMLElement>(".ficha-poster");
  const title = row.querySelector<HTMLElement>(".ficha-title");

  row.classList.add("ficha-measuring");
  const { top: rowTop, bottom: rowBottom } = row.getBoundingClientRect();
  // Rewind to the folded values so the unfold still animates once transitions are back.
  if (detail) detail.style.gridTemplateRows = "0fr";
  if (poster) poster.style.width = "64px";
  if (title) {
    title.style.fontSize = "15px";
    title.style.lineHeight = "1.25";
  }
  void row.offsetHeight;
  row.classList.remove("ficha-measuring");
  if (detail) detail.style.gridTemplateRows = "";
  if (poster) poster.style.width = "";
  if (title) {
    title.style.fontSize = "";
    title.style.lineHeight = "";
  }

  const dock = document.querySelector<HTMLElement>('nav[aria-label="Principal móvil"] > div');
  const header = document.querySelector<HTMLElement>("header.site-header");
  const dockTop = dock && dock.offsetParent !== null ? dock.getBoundingClientRect().top : window.innerHeight;
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const delta = unfoldScrollDelta({
    rowTop,
    rowBottom,
    limitBottom: dockTop - UNFOLD_DOCK_GAP_PX,
    minTop: headerBottom + UNFOLD_HEADER_GAP_PX,
  });
  if (delta > 0) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // "instant", not "auto": the document's own scroll-behavior may be smooth.
    window.scrollBy({ top: delta, behavior: reduced ? "instant" : "smooth" });
  }
};
