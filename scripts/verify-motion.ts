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
const titleCard = read("src/components/TitleCard.tsx");
const titleHero = read("src/components/TitleHero.tsx");
const bottomNav = read("src/components/BottomNav.tsx");
const segment = read("src/components/ListsEtiquetasSegment.tsx");
const listasLoading = read("src/app/listas/loading.tsx");
const tagsLoading = read("src/app/tags/loading.tsx");
const listCard = read("src/components/ListCard.tsx");
const tagsPage = read("src/app/tags/page.tsx");
const diaryMonth = read("src/components/DiaryMonthList.tsx");

assert(
  actionRow.includes("MarkWatchedSheet"),
  "Ficha mark-seen uses the deck eye sheet",
);
assert(
  !actionRow.includes("Quiero ver"),
  "TitleActionRow must not duplicate Quiero ver (primary lives on TitleSaveCta)",
);
assert(
  actionRow.includes("grid-cols-4"),
  "TitleActionRow chip row is four actions after dropping the watchlist chip",
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
assert(
  titleCard.includes("SharedPoster") && titleCard.includes("card-physics"),
  "TitleCard tile→ficha uses SharedPoster + card-physics",
);
assert(
  titleCard.includes("var(--duration-hover)") && !titleCard.includes("duration-200"),
  "TitleCard poster hover uses --duration-hover (not duration-200)",
);

assert(bottomNav.includes("tab-transition"), "Bottom nav uses tab-transition");
assert(segment.includes("tab-transition"), "Listas|Etiquetas uses tab-transition");
assert(
  listasLoading.includes("ListsEtiquetasSegment") &&
    tagsLoading.includes("ListsEtiquetasSegment"),
  "Soft Listas↔Etiquetas loading keeps the segment chrome",
);

assert(listCard.includes("card-physics"), "ListCard uses card-physics");
assert(
  tagsPage.includes("stagger-in") && tagsPage.includes("card-physics"),
  "Tags grid uses stagger + card-physics",
);
assert(
  diaryMonth.includes("stagger-in") && diaryMonth.includes("press-scale"),
  "Historial month rows stagger + press",
);

assert(
  motionDoc.includes("--duration-press") &&
    motionDoc.includes("480") &&
    motionDoc.includes("prefers-reduced-motion"),
  "docs/motion.md documents Artist F2 tokens",
);

console.log(
  "✓ Fase 2 Artist lock: tokens, sheet-rise, SharedPoster, stagger, tabs, toast, docs",
);
