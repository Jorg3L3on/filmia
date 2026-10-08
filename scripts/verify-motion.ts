import { readFileSync } from "node:fs";
import path from "node:path";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const actionRow = read("src/components/TitleActionRow.tsx");
const saveCta = read("src/components/TitleSaveCta.tsx");
const sheet = read("src/components/Sheet.tsx");
const css = read("src/app/globals.css");
const ui = read("src/lib/ui.ts");
const motion = read("src/lib/motion.ts");
const motionDoc = read("docs/motion.md");
const searchSheet = read("src/components/SearchPreviewSheet.tsx");
const addToList = read("src/components/AddTitleToListCta.tsx");
const ratingSheet = read("src/components/RatingSheet.tsx");
const filtersSheet = read("src/components/CatalogMoreFilters.tsx");
const markWatched = read("src/components/MarkWatchedSheet.tsx");
const dayLog = read("src/components/DayLogSheet.tsx");
const toast = read("src/components/SuccessToast.tsx");
const sharedPoster = read("src/components/SharedPoster.tsx");
const posterTile = read("src/components/PosterTile.tsx");
const titleHero = read("src/components/TitleHero.tsx");
const bottomNav = read("src/components/BottomNav.tsx");
const listasLoading = read("src/app/listas/loading.tsx");
const listCard = read("src/components/ListCard.tsx");
const posterStack = read("src/components/PosterStack.tsx");
const listasPage = read("src/app/listas/page.tsx");

assert(
  actionRow.includes("MarkWatchedSheet"),
  "Ficha mark-seen uses the deck eye sheet",
);
assert(
  !actionRow.includes("Quiero ver"),
  "TitleActionRow must not duplicate Quiero ver (primary lives on TitleSaveCta)",
);
assert(
  actionRow.includes("grid-cols-3"),
  "TitleActionRow chip row is three actions (Visto · Nota · Lista)",
);
assert(
  saveCta.includes("useStickyOptimistic"),
  "TitleSaveCta keeps the optimistic watchlist toggle",
);
assert(
  saveCta.includes("En Quiero ver") && saveCta.includes("addToWatchlistById"),
  "TitleSaveCta remains the unique Quiero ver control",
);

assert(
  /dragDismiss = true/.test(sheet),
  "Sheet drag-dismiss is on by default",
);
for (const [name, src] of [
  ["SearchPreviewSheet", searchSheet],
  ["AddTitleToListCta", addToList],
  ["RatingSheet", ratingSheet],
  ["CatalogMoreFilters", filtersSheet],
  ["MarkWatchedSheet", markWatched],
  ["DayLogSheet", dayLog],
] as const) {
  assert(src.includes("dragDismiss"), `${name} enables drag-dismiss`);
  assert(src.includes("SheetHandle") || name === "DayLogSheet", `${name} uses SheetHandle`);
}
assert(dayLog.includes("SheetHandle"), "DayLogSheet uses SheetHandle");

assert(
  ui.includes("sheet-rise") && ui.includes("safe-area-inset-bottom"),
  "Shared sheet panel has sheet-rise and safe-area padding",
);
assert(
  css.includes("--duration-press: 160ms") &&
    css.includes("--duration-hover: 220ms") &&
    css.includes("--duration-morph: 380ms") &&
    css.includes("--duration-sheet: 480ms") &&
    css.includes("--duration-toast: 280ms") &&
    css.includes("--duration-enter: 280ms") &&
    css.includes("--duration-tab: 200ms") &&
    css.includes("--duration-stagger: 420ms") &&
    css.includes("--duration-pop: 420ms"),
  "Artist F2 duration tokens must match locked scale",
);
assert(
  css.includes("prefers-reduced-motion"),
  "Motion language documents reduced motion",
);
assert(
  css.includes("animation: sheet-rise var(--duration-sheet) var(--ease-out)"),
  "Sheets open with ease-out sheet-rise, not spring-pop",
);
assert(
  !/sheet-rise \{[^}]*var\(--spring\)/.test(css),
  "sheet-rise must not use the bounce spring",
);
assert(
  motion.includes("var(--duration-sheet)") &&
    motion.includes("var(--ease-out)") &&
    !motion.includes('transform 420ms var(--spring)'),
  "Sheet drag snap-back uses sheet duration + ease-out, not spring",
);

assert(
  toast.includes("toast-in") && toast.includes("toast-out"),
  "Toasts animate in and out",
);
assert(!toast.includes("spring-pop"), "Toasts must not use spring-pop");
assert(
  toast.includes("reduced ? 20 : 280"),
  "Toast exit wait matches --duration-toast 280ms",
);

assert(
  sharedPoster.includes('share="morph"') &&
    sharedPoster.includes("posterTransitionName"),
  "SharedPoster uses ViewTransition morph names",
);
assert(
  posterTile.includes("SharedPoster") && titleHero.includes("SharedPoster"),
  "PosterTile and ficha hero share poster-{id}",
);

assert(bottomNav.includes("tab-transition"), "Bottom nav uses tab-transition");
assert(
  listasLoading.includes("PageHeader") && listasLoading.includes("ListsBodySkeleton"),
  "Listas loading keeps the header and only shimmers the body",
);

assert(listCard.includes("card-physics"), "ListCard uses card-physics");
assert(
  /@media \(hover: hover\)\s*\{\s*\.card-physics:hover/.test(css),
  "card-physics hover lift only on hover-capable pointers (no sticky hover on touch)",
);
assert(
  css.includes(".card-physics.press-scale {"),
  "card-physics + press-scale share one transition (press owns transform)",
);
assert(
  posterStack.includes("SharedPoster"),
  "PosterStack wraps posters in SharedPoster for list morph",
);
assert(
  listasPage.includes("stagger-in") &&
    listasPage.includes("<ListCard") &&
    listCard.includes("card-physics"),
  "Listas grid uses stagger + card-physics",
);

assert(
  motionDoc.includes("--duration-press") &&
    motionDoc.includes("480") &&
    motionDoc.includes("prefers-reduced-motion"),
  "docs/motion.md documents Artist F2 tokens",
);

// iOS PWA audit, step 1 — sheets, menus and the tab bar.
const zIndex = (name: string) => Number(new RegExp(`--z-index-${name}:\\s*(\\d+)`).exec(css)?.[1] ?? NaN);
assert(
  zIndex("sheet-preview") > 50 && zIndex("sheet") > 50 && zIndex("sheet-top") > zIndex("sheet"),
  "Every sheet layer must sit above the mobile tab bar (z-50)",
);
assert(
  /portal = true/.test(sheet) && !/default: "z-50"/.test(ui),
  "Sheets portal to <body> by default and the default layer is not z-50",
);
const enterAnimations = ["sheet-rise", "stagger-enter", "fade-up", "toast-in", "deck-deal"];
for (const name of enterAnimations) {
  assert(
    !new RegExp(`animation: ${name} [^;]* both;`).test(css),
    `${name} must use fill-mode backwards: \`both\` holds the last frame and overrides press/drag transforms`,
  );
}
assert(
  !css.includes("dock-menu-pop") &&
    /\.dock-search\.press-scale \{[^}]*--duration-press\) var\(--spring\)[^}]*--duration-tab\) var\(--ease-out\)/.test(css) &&
    css.includes('.dock-search[aria-current="page"]'),
  "Dock Buscar disc: lights on /buscar with --duration-tab · --ease-out; the «+» menu pop is gone",
);
assert(
  /\.tonight-pin\.press-scale \{[^}]*--duration-press\) var\(--spring\)[^}]*--duration-tab\) var\(--ease-out\)/.test(css) &&
    searchSheet.includes("celebrate && \"spring-pop\"") &&
    motionDoc.includes(".tonight-pin"),
  "«Ver esta noche»: press spring + ease-out light; the moon pops only right after the tap; documented",
);
assert(
  /\.person-card-in \{[^}]*genre-coverflow-title-in var\(--duration-stagger\) var\(--ease-out\)/.test(css) &&
    /prefers-reduced-motion[\s\S]*\.person-card-in,/.test(css) &&
    motionDoc.includes(".person-card-in"),
  "Buscar person card blurs in with ease-out, off under reduced motion, documented",
);
{
  const sharedChips = read("src/lib/catalog-filters.ts");
  const buscarChips = read("src/components/tmdb-search/TmdbKindFilterChips.tsx");
  assert(
    !/Director/.test(sharedChips.slice(sharedChips.indexOf("KIND_CHIPS"), sharedChips.indexOf("] as const"))) &&
      buscarChips.includes('value: "DIRECTOR"'),
    "«Director» chip lives only in Buscar; the shared KIND_CHIPS (Quiero ver) stay Todos/Películas/Series",
  );
}
{
  const dock = read("src/components/BottomNav.tsx");
  const field = read("src/components/DockSearchField.tsx");
  const topForm = read("src/components/tmdb-search/TmdbSearchForm.tsx");
  assert(
    dock.includes('name="dock-shell"') &&
      dock.includes('name="dock-search"') &&
      /\[DOCK_SEARCH_TRANSITION\]: "morph", default: "none"/.test(dock) &&
      dock.includes("transitionTypes={[DOCK_SEARCH_TRANSITION]}"),
    "Buscar dock morph: shared ViewTransitions (dock-shell / dock-search) only on the dock's own taps",
  );
  assert(
    /prefers-reduced-motion[^@]*::view-transition-old\(dock-shell\)[^}]*dock-crossfade-out/.test(css) &&
      motionDoc.includes("Dock → campo"),
    "Reduced motion: the dock crossfades into the field (no travel or scale); documented",
  );
  assert(
    field.includes("text-base") && field.includes('enterKeyHint="search"') && field.includes("visualViewport"),
    "Dock field: 16 px input (no iOS zoom), search key, rides the keyboard via visualViewport",
  );
  assert(topForm.includes("hidden") && topForm.includes("sm:block"), "One field on mobile: the top form is desktop only");
}
assert(
  css.includes("@keyframes sheet-fall") && css.includes(".sheet-overlay-out") && sheet.includes("sheet-fall"),
  "Sheets need an exit animation (sheet-fall + overlay fade) before unmounting",
);
assert(
  css.includes(".sheet-drag-zone") && /touch-action: none/.test(css.slice(css.indexOf(".sheet-drag-zone"))),
  "Sheet drag zone sets touch-action: none so iOS does not cancel the gesture",
);
assert(
  sheet.includes("--keyboard-inset") && sheet.includes("visualViewport") && ui.includes("var(--keyboard-inset"),
  "Sheets lift above the iOS keyboard via visualViewport",
);
assert(
  sheet.includes("trapTab") && sheet.includes("previouslyFocused") && sheet.includes("sheetStack"),
  "Sheets trap focus, restore it on close, and only the topmost reacts to Escape",
);

console.log(
  "✓ Fase 2 Artist lock: tokens, sheet-rise, SharedPoster, stagger, tabs, toast, docs",
);
console.log(
  "✓ iOS audit step 1: sheet layers above tab bar, exit + drag tracking, focus, keyboard lift, dock Buscar disc",
);
