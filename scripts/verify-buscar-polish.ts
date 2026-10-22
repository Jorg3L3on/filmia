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
// FIL-I21-8: the start rows («Directores de tus favoritas», «Llegó a tu plataforma») always show when they have data; the empty card only without any.
const start = read("src/components/tmdb-search/BuscarStart.tsx");
assert(start.includes("recents.length === 0 && directors.length === 0 && arrivals.length === 0") && start.includes("<FavoriteDirectors directors={directors} />") && start.includes("<PlatformArrivalsRow arrivals={arrivals} />") && start.includes("Llegó a tu plataforma"), "Buscar start: both rows as start rows, empty card only when nothing");
assert(add.includes("arrivals={startArrivals}") && read("src/app/buscar/page.tsx").includes("getStartArrivals(userId)") && read("src/lib/buscar-start.ts").includes("loadUserPlatformArrivals"), "Buscar page loads the platform arrivals for the start screen");
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

// FIL-I22 · Buscar pulido (canvas https://claude.ai/artifact/FmK4trqhXrqydNESCz71aT).
const menu = read("src/components/tmdb-search/SearchRowMenu.tsx");
assert(menu.includes("scrimPointerRef") && menu.includes('via === "touch"'), "FIL-I22-1: the scrim ignores the opening hold's click; touch skips the focus ring");
assert(row.includes("data-search-facts") && row.includes("FactsRow"), "FIL-I22-2: the data line is two lines (IMDb · afinidad / premio · plataforma)");
assert(add.includes("DiaryBand") && row.includes("data-search-log") && row.includes("Registrada · "), "FIL-I22-3: Diario band + check per row");
assert(results.includes("Cargar 20 más") && read("src/lib/tmdb.ts").includes("searchTmdbMultiPage") && read("src/components/tmdb-search/useSearchFacts.ts").includes("RETRY_DELAYS_MS = [2500]"), "FIL-I22-4: TMDB pages, «Cargar 20 más», one facts retry");
assert(read("src/lib/person-filmography.ts").includes("isRealDirectorFor") && results.includes("Buscar como director") && row.includes("Esta noche"), "FIL-I22-5: real director, empty state that keeps searching, pinned row");
assert(read("src/components/BottomNav.tsx").includes("search-back") && read("src/lib/dock-search.ts").includes("setBack"), "FIL-I22-6: the dock's disc is the one «atrás» over a search");
assert(read("src/components/PageSkeletons.tsx").includes('"hidden h-12 rounded-xl sm:block"'), "FIL-I22-7: no ghost field in the search skeleton on phones");
assert(read("src/components/DockSearchField.tsx").includes("disabled={disabled}") && read("src/components/TmdbSearchUnavailable.tsx").includes("DockSearchDisabled"), "FIL-I22-7: TMDB off disables the dock field");

console.log("✓ Buscar · Fichas: filas, chips con pill, conteo, inicio (Recientes + directores), escritorio en 2 columnas · sin hoja: fila = ficha, mantener = menú anclado");
