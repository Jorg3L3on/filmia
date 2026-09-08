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
const searchSheet = read("src/components/SearchPreviewSheet.tsx");
const addToList = read("src/components/AddTitleToListCta.tsx");
const ratingSheet = read("src/components/RatingSheet.tsx");
const filtersSheet = read("src/components/CatalogMoreFilters.tsx");
const toast = read("src/components/SuccessToast.tsx");

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
assert(
  searchSheet.includes("dragDismiss") && searchSheet.includes("SheetHandle"),
  "SearchPreviewSheet uses sheet-rise chrome with drag-dismiss",
);
assert(addToList.includes("dragDismiss"), "AddTitleToListCta enables drag-dismiss");
assert(ratingSheet.includes("dragDismiss"), "RatingSheet enables drag-dismiss");
assert(filtersSheet.includes("dragDismiss"), "CatalogMoreFilters enables drag-dismiss");

assert(
  ui.includes("sheet-rise") && ui.includes("safe-area-inset-bottom"),
  "Shared sheet panel has sheet-rise and safe-area padding",
);
assert(
  css.includes("--duration-sheet") && css.includes("prefers-reduced-motion"),
  "Motion language documents durations and reduced motion",
);
assert(
  css.includes("animation: sheet-rise var(--duration-sheet) var(--ease-out)"),
  "Sheets open with ease-out sheet-rise, not spring-pop",
);
assert(
  !css.includes("animation: sheet-rise") ||
    !/sheet-rise \{[^}]*var\(--spring\)/.test(css),
  "sheet-rise must not use the bounce spring",
);
assert(
  toast.includes("toast-in") && toast.includes("toast-out"),
  "Toasts animate in and out",
);
assert(
  !toast.includes("spring-pop"),
  "Toasts must not use spring-pop",
);

console.log("✓ Fase 2: unique Quiero ver, sheet-rise, drag-dismiss, toast motion");
