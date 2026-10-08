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
assert(add.includes("canOfferTonightPin") && add.includes("handlePinTonight"), "FIL-I3's «Ver esta noche» is untouched");

const page = read("src/app/buscar/page.tsx");
assert(page.includes("getFavoriteDirectors") && page.includes("loadPersonView"), "Page loads start directors and keeps the person view");

const css = read("src/app/globals.css");
const reduced = css.slice(css.indexOf(".buscar-shiny {"));
assert(/prefers-reduced-motion: reduce\)\s*\{\s*\.buscar-chip-pill/.test(reduced), "Reduced motion stops the chip pill and the shiny text");
assert(read("docs/motion.md").includes("buscar-chip-pill"), "docs/motion.md documents the Buscar polish");

console.log("✓ Buscar · Fichas: filas, chips con pill, conteo, inicio (Recientes + directores), escritorio en 2 columnas");
