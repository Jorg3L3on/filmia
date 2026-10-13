import { readFileSync } from "node:fs";
import path from "node:path";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

// FIL-I5-4 · Buscar polish, direction A «Fichas» (canvas https://claude.ai/artifact/2rSJnRDQ5tNQbNaZp396u8).
const row = read("src/components/tmdb-search/SearchResultRow.tsx");
assert(row.includes("glassRowClass") && row.includes("font-serif"), "Result rows use La cartelera's glass row with a serif title");
assert(row.includes("En Quiero ver") && row.includes("La viste"), "Rows say where the title already is, in words");
assert(row.includes("originalName"), "Rows show the original title when it differs");

const results = read("src/components/TmdbSearchResults.tsx");
assert(results.includes("WatchlistCountTicker") && results.includes("lg:grid-cols-2"), "Results count rolls; desktop shows two columns");

const chips = read("src/components/tmdb-search/TmdbKindFilterChips.tsx");
assert(chips.includes("buscar-chip-pill") && chips.includes("DIRECTOR"), "Chips keep Director and slide one pill under the current one");

const add = read("src/components/TmdbSearchAdd.tsx");
assert(add.includes("BuscarStart") && add.includes("useSearchRecents"), "Buscar opens on the start screen (Recientes + directors)");
assert(add.includes("DockSearchField") || read("src/components/BottomNav.tsx").includes("DockSearchField") || add.includes("dockSearch"), "FIL-I3's dock field is still wired");
const shortcuts = read("src/components/tmdb-search/SearchShortcuts.tsx");
assert(
  add.includes("handlePinTonight") && shortcuts.includes("canOfferTonightPin"),
  "FIL-I3's «Ver esta noche» lives on in the held row's menu",
);

// FIL-I8 · Buscar without the sheet (canvas https://claude.ai/artifact/Kqz6rhKQLiXDgFH2qd6Fg2).
assert(!add.includes("SearchPreviewSheet"), "Buscar no longer opens the preview sheet");
assert(row.includes("<Link") && row.includes("prefetch={false}"), "A result is a link to its ficha, never prefetched (no Catalog upserts on scroll)");
assert(row.includes("useLongPress") && row.includes("onContextMenu"), "Holding (or right-clicking) a row opens the shortcuts");
assert(add.includes("previewFichaHref") && add.includes("ownedFichaHref"), "Rows go to your ficha or the TMDB preview, keeping Diario mode");
const hook = read("src/components/tmdb-search/useTmdbSearchAdd.ts");
assert(!hook.includes("handleOpen"), "Opening a ficha never creates a Title (the old FICHA button did)");
assert(read("src/components/tmdb-search/SearchRowMenu.tsx").includes("createPortal"), "Mantener A: the menu is anchored over a blurred list");

// FIL-I8-4 · row A «Línea de datos»: IMDb · premio · plataforma from the shared Catalog.
assert(row.includes("SearchFactsLine") && row.includes("ImdbBadge") && row.includes("LaurelIcon"), "Rows show IMDb, the award and the platform (row A)");
const facts = read("src/app/actions/search-facts.ts");
assert(
  facts.includes("pickEnrichmentCandidates") && facts.includes("takeEnrichBudget") && facts.includes("scheduleAfterResponse"),
  "Unknown films are enriched after the response, capped per search and per user",
);

const page = read("src/app/buscar/page.tsx");
assert(page.includes("getFavoriteDirectors") && page.includes("loadPersonView"), "Page loads start directors and keeps the person view");

const css = read("src/app/globals.css");
const reduced = css.slice(css.indexOf(".buscar-shiny {"));
assert(/prefers-reduced-motion: reduce\)\s*\{\s*\.buscar-chip-pill/.test(reduced), "Reduced motion stops the chip pill and the shiny text");
assert(/\.search-menu-panel\s*\{\s*animation: none/.test(reduced), "Reduced motion keeps the held-row menu still");
assert(read("docs/motion.md").includes("buscar-chip-pill"), "docs/motion.md documents the Buscar polish");

console.log("✓ Buscar · Fichas: filas, chips con pill, conteo, inicio (Recientes + directores), escritorio en 2 columnas · sin hoja: fila = ficha, mantener = menú anclado");
