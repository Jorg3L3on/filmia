/**
 * Shallow URL writes for a deck that is moving (FIL-I58-4). `history.replaceState` is a native
 * call per card passed (Safari throws after 100 in 10 s) and it has no business inside a swipe:
 * the URL is written once the deck has rested, and at the latest before anything is clicked or
 * the page is hidden, so Back from a ficha still lands on the same card.
 */
export const REST_URL_DELAY_MS = 400;

let pendingUrl: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

export const flushRestUrl = () => {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
  }
  if (pendingUrl == null) {
    return;
  }
  const url = pendingUrl;
  pendingUrl = null;
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
};

/** The last call within the delay wins. */
export const replaceUrlAtRest = (url: string) => {
  listen();
  pendingUrl = url;
  if (timer != null) {
    clearTimeout(timer);
  }
  timer = setTimeout(flushRestUrl, REST_URL_DELAY_MS);
};
