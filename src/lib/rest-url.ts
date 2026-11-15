/**
 * Shallow URL writes for a deck that is moving (FIL-I58-4). `history.replaceState` is a native
 * call per card passed (Safari throws after 100 in 10 s) and it has no business inside a swipe:
 * the URL is written once the deck has rested, and at the latest before anything is clicked or
 * the page is hidden, so Back from a ficha still lands on the same card.
 *
 * A write still waiting when the page changes (Back, an iOS edge swipe, a navigation that is
 * not a click) is dropped: it belongs to the page that queued it, and run later it would put
 * Hoy's URL on another page's history entry (FIL-I58-8).
 */
export const REST_URL_DELAY_MS = 400;

let pending: { url: string; pathname: string } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

const clearTimer = () => {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
  }
};

/** Forgets a write that has not run yet. */
export const dropRestUrl = () => {
  clearTimer();
  pending = null;
};

export const flushRestUrl = () => {
  clearTimer();
  if (pending == null) {
    return;
  }
  const { url, pathname } = pending;
  pending = null;
  if (window.location.pathname !== pathname) {
    return;
  }
  window.history.replaceState(null, "", url);
};

const listen = () => {
  if (listening) {
    return;
  }
  listening = true;
  // Capture phase: runs before the Link's own onClick starts a navigation.
  document.addEventListener("click", flushRestUrl, true);
  window.addEventListener("pagehide", flushRestUrl);
  // Back/forward already moved to another entry: the write is not for it.
  window.addEventListener("popstate", dropRestUrl);
};

/** The last call within the delay wins. */
export const replaceUrlAtRest = (url: string) => {
  listen();
  pending = { url, pathname: window.location.pathname };
  clearTimer();
  timer = setTimeout(flushRestUrl, REST_URL_DELAY_MS);
};
