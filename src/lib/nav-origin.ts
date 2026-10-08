/**
 * Where the user came from, per tab: a short stack of the pages visited in this
 * tab (sessionStorage), so a ficha can say «‹ Hoy · Terror» and go back to the
 * exact spot. Pure; the browser glue lives in NavOriginTracker / BackButton.
 *
 * Rules for each location change:
 * - same page, new query (Hoy's lens/card, Buscar's chip) → the top entry's href is replaced;
 * - the page right below the top (Back, the iOS edge swipe, or tapping the origin) → pop;
 * - anything else → push.
 */

/** The first visible row when the user left (`[data-ficha="…"]`) and its distance from the top. */
export type NavAnchor = { selector: string; offset: number };

export type NavEntry = {
  href: string;
  label: string;
  /** Window scroll when the user left the page; restored on the way back. */
  scrollY?: number;
  /** Preferred over scrollY: rows above may grow after mount (hooks, expanded rows). */
  anchor?: NavAnchor;
};

export const NAV_STACK_KEY = "filmia.nav-origin";
export const NAV_STACK_LIMIT = 12;
export const NAV_LABEL_MAX = 28;
export const HOME_ENTRY: NavEntry = { href: "/", label: "Hoy" };

/** Hoy's exact card travels in the URL next to the lens: `/?lente=terror&carta=<titleId>`. */
export const DECK_CARD_PARAM = "carta";

export type NavStorage = Pick<Storage, "getItem" | "setItem">;

const SKIPPED_PREFIXES = ["/login", "/registro", "/bienvenida", "/api"];

export const pathOf = (href: string) => href.split(/[?#]/)[0] || "/";

const STATIC_LABELS: Array<[RegExp, string]> = [
  [/^\/$/, "Hoy"],
  [/^\/watchlist(\/|$)/, "Quiero ver"],
  [/^\/listas(\/|$)/, "Listas"],
  [/^\/buscar(\/|$)/, "Buscar"],
  [/^\/perfil(\/|$)/, "Perfil"],
  [/^\/diario(\/|$)/, "Diario"],
  [/^\/titulos\//, "Ficha"],
];

/** Label a page gets before it names itself (useNavLabel): «Hoy», «Quiero ver», «Listas»… */
export const defaultNavLabel = (href: string) => {
  const path = pathOf(href);
  return STATIC_LABELS.find(([pattern]) => pattern.test(path))?.[1] ?? "Atrás";
};

/** Login, signup and the first-run flow are never an origin. */
export const isTrackedHref = (href: string) => {
  const path = pathOf(href);
  return path.startsWith("/") && !SKIPPED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

const TITLE_SUFFIX = " · Filmia";

/**
 * A ficha left before it hydrated still has the default «Ficha»: its
 * document title («Obsesión · Filmia») names it just as well.
 */
export const labelFromDocumentTitle = (href: string, documentTitle: string) => {
  if (!/^\/titulos\//.test(pathOf(href)) || !documentTitle.endsWith(TITLE_SUFFIX)) {
    return null;
  }
  const name = documentTitle.slice(0, -TITLE_SUFFIX.length).trim();
  return name ? name : null;
};

export const truncateNavLabel = (label: string, max = NAV_LABEL_MAX) => {
  const clean = label.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

export type VisitResult = {
  stack: NavEntry[];
  /** Set when the visit went back to an entry already on the stack (scroll to restore). */
  restored: NavEntry | null;
  /** push = a new page (starts at the top); replace = same page, new query; pop = back. */
  kind: "push" | "replace" | "pop" | "none";
};

export const recordVisit = (stack: readonly NavEntry[], href: string): VisitResult => {
  if (!isTrackedHref(href)) {
    return { stack: [...stack], restored: null, kind: "none" };
  }
  const top = stack.at(-1);
  if (!top) {
    return { stack: [{ href, label: defaultNavLabel(href) }], restored: null, kind: "none" };
  }
  if (top.href === href) {
    return { stack: [...stack], restored: null, kind: "none" };
  }
  if (pathOf(top.href) === pathOf(href)) {
    return { stack: [...stack.slice(0, -1), { ...top, href }], restored: null, kind: "replace" };
  }
  const below = stack.at(-2);
  if (below && pathOf(below.href) === pathOf(href)) {
    const back = { ...below, href };
    return { stack: [...stack.slice(0, -2), back], restored: back, kind: "pop" };
  }
  return {
    stack: [...stack, { href, label: defaultNavLabel(href) }].slice(-NAV_STACK_LIMIT),
    restored: null,
    kind: "push",
  };
};

/** The page names itself («Hoy · Terror», «Obsesión», «Listas · Para Halloween»). */
export const labelCurrent = (stack: readonly NavEntry[], href: string, label: string): NavEntry[] => {
  const top = stack.at(-1);
  const clean = label.replace(/\s+/g, " ").trim();
  if (!top || !clean || pathOf(top.href) !== pathOf(href) || top.label === clean) {
    return [...stack];
  }
  return [...stack.slice(0, -1), { ...top, label: clean }];
};

/**
 * Before leaving (tap, scroll, pagehide): the top entry takes the live URL and
 * scroll. Some pages rewrite their query with `replaceState(history.state)`,
 * which Next does not report to `useSearchParams` (Buscar's chip), so the
 * location is read here rather than trusted from the last route change.
 */
export const saveCurrentScroll = (
  stack: readonly NavEntry[],
  href: string,
  scrollY: number,
  anchor?: NavAnchor | null,
): NavEntry[] => {
  const top = stack.at(-1);
  if (!top || pathOf(top.href) !== pathOf(href) || !Number.isFinite(scrollY) || !isTrackedHref(href)) {
    return [...stack];
  }
  const rounded = Math.max(0, Math.round(scrollY));
  const next: NavEntry = { ...top, href, scrollY: rounded };
  if (anchor) {
    next.anchor = { selector: anchor.selector, offset: Math.round(anchor.offset) };
  } else {
    delete next.anchor;
  }
  return JSON.stringify(next) === JSON.stringify(top) ? [...stack] : [...stack.slice(0, -1), next];
};

/** The page the current one was opened from; null on a direct link or a fresh tab. */
export const navOrigin = (stack: readonly NavEntry[]): NavEntry | null => stack.at(-2) ?? null;

export type BackAction = { kind: "back" } | { kind: "push"; href: string };

/**
 * `router.back()` only when the browser's previous entry is the origin (an
 * in-app visit in this tab); otherwise (direct link, reload into a fresh tab,
 * PWA cold start) push the origin, or Hoy, so «atrás» never leaves Filmia.
 */
export const backAction = (stack: readonly NavEntry[], historyLength: number): BackAction => {
  const origin = navOrigin(stack);
  if (origin && historyLength > 1) {
    return { kind: "back" };
  }
  return { kind: "push", href: origin?.href ?? HOME_ENTRY.href };
};

export const backLabel = (stack: readonly NavEntry[]) =>
  truncateNavLabel(navOrigin(stack)?.label ?? HOME_ENTRY.label);

const isAnchor = (value: unknown): value is NavAnchor =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as NavAnchor).selector === "string" &&
  typeof (value as NavAnchor).offset === "number";

const isEntry = (value: unknown): value is NavEntry => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.href === "string" &&
    entry.href.startsWith("/") &&
    typeof entry.label === "string" &&
    (entry.scrollY === undefined || typeof entry.scrollY === "number") &&
    (entry.anchor === undefined || isAnchor(entry.anchor))
  );
};

export const readNavStack = (storage?: NavStorage | null): NavEntry[] => {
  if (!storage) {
    return [];
  }
  try {
    const parsed = JSON.parse(storage.getItem(NAV_STACK_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(-NAV_STACK_LIMIT) : [];
  } catch {
    return [];
  }
};

export const writeNavStack = (stack: readonly NavEntry[], storage?: NavStorage | null) => {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(NAV_STACK_KEY, JSON.stringify(stack.slice(-NAV_STACK_LIMIT)));
  } catch {
    // Private mode / quota: the back button falls back to Hoy.
  }
};

/** `/?lente=terror&carta=abc` → `abc`. */
export const deckCardFrom = (search: string) => {
  const value = new URLSearchParams(search).get(DECK_CARD_PARAM)?.trim();
  return value ? value : null;
};

/** `searchParams.carta` from a server page (first value, trimmed). */
export const parseDeckCard = (value: string | string[] | undefined) => {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
};

/** The current URL with `carta` set (other params kept, `carta` last). */
export const withDeckCard = (href: string, cardId: string) => {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query.split("#")[0]);
  params.delete(DECK_CARD_PARAM);
  params.set(DECK_CARD_PARAM, cardId);
  return `${path || "/"}?${params.toString()}`;
};

/** Index of the remembered card in the deck; null when it is gone (the deck was recomputed). */
export const deckIndexOf = (titles: ReadonlyArray<{ id: string }>, cardId: string | null) => {
  if (!cardId) {
    return null;
  }
  const index = titles.findIndex((title) => title.id === cardId);
  return index >= 0 ? index : null;
};
