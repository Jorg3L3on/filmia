/**
 * The poster cut list → ficha (FIL-I46-2). When a tap opens a ficha, the tapped poster's image is
 * remembered for a few seconds, so the ficha's loading skeleton can show that same poster inside
 * its `poster-{id}` ViewTransition: the morph lands at once instead of on a grey block.
 * Per tab, in memory: nothing is stored.
 */

const FLIGHT_TTL_MS = 8000;
const flights = new Map<string, { src: string; at: number }>();
/** The ficha the last tap opened: the only poster that may fly home on «atrás». */
let openedId: string | null = null;

/** `/titulos/abc?carta=1` → `abc`; tmdb previews and `/titulos/nuevo` have no flight. */
export const titleIdFromHref = (href: string | null | undefined) => {
  if (!href) return null;
  let path = href;
  try {
    path = new URL(href, "http://x").pathname;
  } catch {
    return null;
  }
  const match = /^\/titulos\/([a-z0-9]+)\/?$/i.exec(path);
  return match && match[1] !== "nuevo" ? match[1] : null;
};

export const rememberPosterFlight = (titleId: string, src: string, now = Date.now()) => {
  if (!titleId) return;
  openedId = titleId;
  if (!src) return;
  flights.set(titleId, { src, at: now });
  for (const [id, flight] of flights) {
    if (now - flight.at > FLIGHT_TTL_MS) flights.delete(id);
  }
};

export const posterFlightFor = (titleId: string | null | undefined, now = Date.now()) => {
  if (!titleId) return null;
  const flight = flights.get(titleId);
  return flight && now - flight.at <= FLIGHT_TTL_MS ? flight.src : null;
};

/*
 * The way back. A browser «atrás» is a history traversal: no view transition runs. So each shared
 * poster records where it was when it leaves the screen, and on a back navigation the poster that
 * mounts with the same id flies home from there (a FLIP on transform only).
 */
const RETURN_TTL_MS = 1500;
type Rect = { x: number; y: number; width: number; height: number };
const rects = new Map<string, { rect: Rect; at: number }>();
let popAt = Number.NEGATIVE_INFINITY;

export const rememberPosterRect = (titleId: string, rect: Rect, now = Date.now()) => {
  if (rect.width > 0 && rect.height > 0) rects.set(titleId, { rect, at: now });
};

export const markHistoryPop = (now = Date.now()) => {
  popAt = now;
};

/** Where the poster should fly home from, only right after a back/forward traversal. */
export const takePosterReturn = (titleId: string, now = Date.now()) => {
  const entry = rects.get(titleId);
  if (titleId !== openedId || !entry || now - popAt > RETURN_TTL_MS || now - entry.at > RETURN_TTL_MS) return null;
  rects.delete(titleId);
  openedId = null;
  return entry.rect;
};

/** The transform that puts a poster at `to` back where `from` was (scale from the top-left corner). */
export const flipFrom = (from: Rect, to: Rect) => ({
  x: from.x - to.x,
  y: from.y - to.y,
  sx: to.width > 0 ? from.width / to.width : 1,
  sy: to.height > 0 ? from.height / to.height : 1,
});

/** A CSS time token («380ms», «0.38s») in milliseconds. */
export const cssTimeMs = (value: string) => {
  const trimmed = value.trim();
  const number = Number.parseFloat(trimmed);
  if (!Number.isFinite(number)) return 0;
  return trimmed.endsWith("ms") ? number : trimmed.endsWith("s") ? number * 1000 : number;
};
