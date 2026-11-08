/**
 * Chromium skips a view transition with an InvalidStateError when the viewport or the page
 * visibility changes mid-transition (rotating the phone, a resized window, a hidden tab).
 * React DOM treats exactly these messages as benign (`customizeViewTransitionError`), but its
 * `transition.finished.finally(…)` chain still leaves one promise rejecting unhandled, which
 * shows up as «Uncaught (in promise)» and the dev overlay badge (FIL-I44-3).
 * Keep this list in lockstep with React's.
 */
const BENIGN_VIEW_TRANSITION_MESSAGES: ReadonlySet<string> = new Set([
  "View transition was skipped because document visibility state is hidden.",
  "Skipping view transition because document visibility state has become hidden.",
  "Skipping view transition because viewport size changed.",
  "Transition was aborted because of invalid state",
]);

export const isBenignViewTransitionRejection = (reason: unknown): boolean =>
  typeof reason === "object" &&
  reason !== null &&
  (reason as { name?: unknown }).name === "InvalidStateError" &&
  BENIGN_VIEW_TRANSITION_MESSAGES.has(String((reason as { message?: unknown }).message));

/** Mark those rejections handled before anyone else (the dev overlay included) sees them. */
export const ignoreBenignViewTransitionRejections = (target: Pick<Window, "addEventListener">) => {
  target.addEventListener("unhandledrejection", (event) => {
    if (isBenignViewTransitionRejection(event.reason)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
};
