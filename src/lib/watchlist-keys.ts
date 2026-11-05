/**
 * Which Quiero ver shortcut a key press is (FIL-I41-15). The listener lives on `window`, so it
 * must leave alone what the focused control does with the key: Enter on a button opens that
 * button's sheet, a radio inside the Filtros sheet picks itself, and nothing in an open sheet
 * or dialog reaches the list behind it.
 */
export type WatchlistKeyTarget = {
  /** input, textarea, select or contenteditable */
  editable: boolean;
  /** inside an open dialog or sheet ([role=dialog], [aria-modal], <dialog>) */
  inDialog: boolean;
  /** a control that handles Enter itself: link, button, radio, tab, switch, option… */
  interactive: boolean;
  /** inside a Quiero ver row ([data-ficha]) */
  inRow: boolean;
  /** nothing in particular has focus (body / document) */
  onPage: boolean;
};

export type WatchlistKeyAction = "move" | "open" | "mark" | null;

export const watchlistKeyAction = (
  key: string,
  modifiers: { meta: boolean; ctrl: boolean; alt: boolean },
  target: WatchlistKeyTarget,
): WatchlistKeyAction => {
  if (modifiers.meta || modifiers.ctrl || modifiers.alt || target.editable || target.inDialog) {
    return null;
  }
  if (key === "ArrowDown" || key === "ArrowUp") {
    // Arrows still move the selection from anywhere on the page except a radio group.
    return target.interactive && !target.inRow && !target.onPage ? null : "move";
  }
  const onList = target.onPage || target.inRow;
  if (key === "Enter") {
    return onList && !target.interactive ? "open" : null;
  }
  if (key === "v" || key === "V") {
    return onList ? "mark" : null;
  }
  return null;
};

const INTERACTIVE =
  'a[href],button,summary,[role="button"],[role="link"],[role="radio"],[role="checkbox"],[role="tab"],[role="switch"],[role="menuitem"],[role="option"],[role="slider"]';

/** Read the event target into the shape above (browser only). */
export const describeKeyTarget = (target: EventTarget | null): WatchlistKeyTarget => {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) {
    return { editable: false, inDialog: false, interactive: false, inRow: false, onPage: true };
  }
  const tag = target.tagName;
  return {
    editable: target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT",
    inDialog: Boolean(target.closest('[role="dialog"],[aria-modal="true"],dialog')),
    interactive: Boolean(target.closest(INTERACTIVE)),
    inRow: Boolean(target.closest("[data-ficha]")),
    onPage: tag === "BODY" || tag === "HTML",
  };
};
