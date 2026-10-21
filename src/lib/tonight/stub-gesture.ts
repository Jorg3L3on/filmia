/**
 * The «Vi esto» stub's release logic, pure so it can be tested (FIL-I21-1).
 *
 * A finger never lands still: a normal tap slides a few pixels. Below `STUB_TAP_SLOP_PX`
 * the release still counts as a tap and opens the sheet. From the slop up to the tear
 * point the stub springs back and shows a hint; at the tear point it is armed and opens.
 */

/** Drag past this many px and the perforation tears. */
export const STUB_TEAR_PX = 60;
/** Slides shorter than this still count as a tap (a real finger moves 4–10 px). */
export const STUB_TAP_SLOP_PX = 12;
/** How long the «Arranca hasta el fondo» hint stays after a half-hearted pull. */
export const STUB_HINT_MS = 900;

export type StubRelease = "tap" | "tear" | "spring-back";

/** What a pointerup at `dy` px of downward travel does. */
export const resolveStubRelease = (
  dy: number,
  { tapSlop = STUB_TAP_SLOP_PX, tear = STUB_TEAR_PX } = {},
): StubRelease => {
  const travel = Math.max(0, dy);
  if (travel >= tear) {
    return "tear";
  }
  if (travel < tapSlop) {
    return "tap";
  }
  return "spring-back";
};

/** `pointercancel` (scroll took over, the finger left the screen) never opens the sheet. */
export const resolveStubCancel = (): "reset" => "reset";
