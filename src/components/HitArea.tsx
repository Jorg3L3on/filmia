/**
 * Invisible 44 × 44 px (at least) tap area centered on a small control, without changing how it
 * looks (FIL-I44-12). The parent must be positioned (`relative`). A span, not a pseudo-element:
 * liquid-glass pills already use both of theirs.
 */
export const HitArea = () => (
  <span
    aria-hidden="true"
    data-hit-area
    className="absolute left-1/2 top-1/2 h-11 min-h-full w-full min-w-11 -translate-x-1/2 -translate-y-1/2"
  />
);
