import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { awardChipLabel } from "../src/lib/awards";
import { PICK_EVENT_KINDS } from "../src/lib/tonight-store";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const exists = (file: string) => existsSync(path.join(root, file));

const run = () => {
  // Awards: column + OMDb + parser + backfill.
  assert(exists("drizzle/0006_title_awards.sql") && read("drizzle/0006_title_awards.sql").includes("IF NOT EXISTS"), "Migration 0006 (awards) is additive and idempotent");
  assert(read("src/db/schema.ts").includes('awards: text("awards")'), "Title.awards column");
  const omdb = read("src/lib/omdb.ts");
  assert(omdb.includes("Awards") && /"v[2-9]"/.test(omdb) && omdb.includes("imdbVotes"), "OMDb keeps Awards and bumped its cache key");
  assert(awardChipLabel("Won 2 Oscars. 23 wins & 12 nominations total.") === "2 Óscar", "Awards parser → «2 Óscar»");
  assert(awardChipLabel("Nominated for 1 Oscar. 4 wins & 12 nominations total") === "Nominada al Óscar", "Awards parser → «Nominada al Óscar»");
  for (const file of ["src/lib/metadata.ts", "src/lib/catalog-enrich.ts", "scripts/backfill-tonight.ts"]) {
    assert(read(file).includes("awards"), `${file} carries awards along with imdbRating`);
  }
  assert(exists("scripts/backfill-awards.ts") && read("package.json").includes("db:backfill-awards"), "Awards backfill script registered");

  // «Esta noche» pin from Quiero ver.
  assert((PICK_EVENT_KINDS as readonly string[]).includes("pinned"), "PickEvent kind «pinned»");
  assert(read("src/app/actions/tonight.ts").includes("pinTonight"), "pinTonight action");
  const store = read("src/lib/tonight-store.ts");
  assert(store.includes("applyPinnedCard") && store.includes("findPinnedTitleId"), "Store puts the pinned card first in Para ti");
  assert(read("src/lib/tonight/serve.ts").includes("keepPinnedFirst") && read("src/components/tonight/TonightSala.tsx").includes("keepPinnedFirst"), "rankForNow keeps the pinned card first");
  assert(exists("src/lib/use-mounted-now.ts") && !read("src/components/tonight/TonightSala.tsx").includes("createMountedNowStore"), "useMountedNow is shared");
  assert(read("src/lib/fly-to-nav.ts").includes("pulseNav") && read("src/lib/fly-to-nav.ts").includes("flyPosterToProfile"), "Nav pulse generalised, flight kept");
  // FIL-I34-1: «Esta noche» is no longer a Quiero ver filter; only the «termina a tiempo» line keeps the night rule.
  assert(!read("src/lib/catalog-href.ts").includes("TONIGHT_PARAM") && !read("src/components/watchlist/WatchlistCartelera.tsx").includes("tonightOnly"), "No «Esta noche» filter or ?tonight param in Quiero ver");
  assert(read("src/lib/watchlist-query.test.ts").includes("ignores an old ?tonight=1 and shows Todo"), "An old ?tonight=1 link is tested to show Todo");
  assert(read("src/components/watchlist/useFichaViews.ts").includes("isNight(now, nightEnds)"), "Ficha fit only computed at night");

  // The cartelera itself.
  const components = [
    "WatchlistCartelera", "WatchlistFicha", "WatchlistFichaDetail", "WatchlistFichaChips", "WatchlistHookLine",
    "WatchlistHeroCompact", "WatchlistFichaMenu", "WatchlistNoteSheet", "WatchlistGenreSheet", "WatchlistHeader", "WatchlistTopBar",
    "WatchlistScopeBar", "WatchlistChipRow", "WatchlistOrderPill", "WatchlistOrderSheet", "WatchlistFiltersSheet", "WatchlistFilterSections",
    "WatchlistFilterSectionsMore", "WatchlistFilterControls", "WatchlistView", "WatchlistEmpty", "WatchlistOfflineNote",
    "WatchlistReorderList", "WatchlistStickyBar", "WatchlistCountTicker", "WatchlistStage", "WatchlistSwipeLayer",
  ];
  for (const name of components) {
    const file = `src/components/watchlist/${name}.tsx`;
    assert(exists(file), `${file} exists`);
    assert(read(file).split("\n").length < 300, `${file} stays under 300 lines`);
  }
  for (const old of ["WatchlistList", "WatchlistHero", "WatchlistGrid", "WatchlistMarkSeenButton", "PosterPlatformBadge", "watchlist/WatchlistFilterRail"]) {
    assert(!exists(`src/components/${old}.tsx`), `${old} replaced by the cartelera`);
  }
  const page = read("src/app/watchlist/page.tsx");
  const view = read("src/components/watchlist/WatchlistView.tsx");
  assert(page.includes("WatchlistView") && page.includes("getCurrentUserProfile") && view.includes("WatchlistCartelera"), "Page hands the whole list to the view, which wires the cartelera");
  assert(!page.includes("CatalogFilters") && view.includes("WatchlistHeader") && view.includes("useWatchlistQuery()"), "Quiero ver has its own header; CatalogFilters stays for Diario and Listas");
  const fichaRow = read("src/components/watchlist/WatchlistFicha.tsx");
  assert(fichaRow.includes("useSwipeActions") && fichaRow.includes("useLongPress") && fichaRow.includes("onContextMenu") && fichaRow.includes("SharedPoster"), "Ficha: swipe, long-press, right-click, shared poster morph");
  assert(read("src/components/watchlist/WatchlistStage.tsx").includes("share={false}"), "Stage poster never collides with the row's ViewTransition name");
  const swipe = read("src/components/watchlist/useSwipeActions.ts");
  assert(swipe.includes("setPointerCapture") && swipe.includes("SWIPE_ARM_PX = 60"), "Swipe arms at 60 px like the ticket stub");
  const actions = read("src/components/watchlist/useWatchlistActions.ts");
  for (const needle of ["flyPosterToProfile", "undoMarkWatched", "Deshacer", "pinTonight", "markNotTonight", "moveWatchlistItemToTop", "updateWatchlistNote"]) {
    assert(actions.includes(needle), `Cartelera actions include ${needle}`);
  }
  const css = read("src/app/globals.css");
  for (const needle of [".ficha-detail", "grid-template-rows", "@keyframes ficha-detail-in", ".visto-stamp.is-row", "touch-action: pan-y", ".ficha-backdrop"]) {
    assert(css.includes(needle), `globals.css has ${needle}`);
  }
  assert(!/ficha-detail-in[^;]*both/.test(css), "ficha-detail-in never uses fill-mode both");
  assert(read("src/components/CatalogFilters.tsx").split("\n").length < 220, "CatalogFilters stays under 220 lines");

  // Compact header (FIL-I21-7) for Diario / Listas; Quiero ver has its own «Barra de decisión» (FIL-I34).
  const filters = read("src/components/CatalogFilters.tsx");
  assert(filters.includes("heading?: ReactNode") && filters.includes("headingActions?: ReactNode") && filters.includes("compactOnMobile={compact}") && filters.includes("max-sm:[grid-area:2/1/3/4]"), "CatalogFilters folds the title into the Filtros row and gives the rail its own row on the phone");
  assert(view.includes("WatchlistEditingProvider") && !read("src/components/watchlist/WatchlistEditing.tsx").includes("WatchlistReorderButton"), "No round ⇅ button: Reordenar lives in the summary line and the Ordenar sheet");
  const header = read("src/components/watchlist/WatchlistHeader.tsx");
  assert(header.includes("Reordenar") && read("src/components/watchlist/WatchlistOrderSheet.tsx").includes("onReorder") && header.includes("Barajar otra vez") && header.includes("Limpiar filtros"), "Summary line: Limpiar filtros · Barajar otra vez · Reordenar");
  assert(read("src/components/CatalogMoreFilters.tsx").includes('aria-label={') && read("src/components/CatalogMoreFilters.tsx").includes("max-sm:size-8"), "Filtros is a round icon button on the phone, labelled");
  const cartelera = read("src/components/watchlist/WatchlistCartelera.tsx");
  assert(cartelera.includes("useWatchlistEditing()") && cartelera.includes("{isEditing ? (") && cartelera.includes("<WatchlistStickyBar paused={paused}"), "Cartelera shows the Reordenar bar only while editing, with the paused filters");
  assert(header.includes("qv-condensed") && css.includes(".qv-condensed[data-shown=\"true\"]") && /\.qv-condensed \{[^}]*height: 44px/.test(css), "Scrolling away leaves a 44 px bar with title, count, order and funnel");

  // «Barra de decisión» (FIL-I34-2/3/4): 36 px visible / 44 touch, direction arrow 34×44, scope with counts, live «Ver N».
  const chips = read("src/components/watchlist/WatchlistChipRow.tsx");
  assert(/\.qv-chip,\n\.qv-order \{[^}]*height: 36px/.test(css) && css.includes(".qv-chip::before") && /\.qv-order-dir \{[^}]*width: 34px/.test(css), "Chips 36 px with a 44 px touch area; the direction arrow is the 34×44 exception");
  assert(chips.includes("MAX_LINES = 2") && chips.includes("más") && chips.includes("filterChipSpoken"), "Chips wrap to two lines, then «+N más»; each says what it removes");
  assert(read("src/components/watchlist/WatchlistScopeBar.tsx").includes('role="radiogroup"') && read("src/lib/watchlist-chips.ts").includes("minePlatformsCellLabel"), "Scope: Todo / Mis plataformas radiogroup, cell named for 1, 2, 3+ or 0 platforms");
  assert(read("src/components/watchlist/WatchlistFiltersSheet.tsx").includes("Ver <span") && read("src/lib/watchlist-facets.ts").includes("makeWatchlistCounter"), "Filtros sheet: counts and «Ver N» from the same filter as the list");
  assert(read("src/components/watchlist/WatchlistFilterSectionsMore.tsx").includes('badge="Datos parciales"') && read("src/components/watchlist/WatchlistFilterSections.tsx").includes("aún no tiene"), "Director labelled «Datos parciales»; titles without runtime are counted out loud");
  assert(read("src/components/CatalogFilters.tsx").includes("minePlatformsInBar && minePlatforms ? 1 : 0"), "CatalogFilters (Diario, Listas) unchanged");
  assert(css.includes("@media (prefers-reduced-transparency: reduce) {\n  .qv-round"), "Reduced transparency: the header drops the glass");

  // Piezas (FIL-I24-4): truthful eyebrow under a sort, one empty state that names the chip, platform in «Vi esto».
  assert(exists("src/lib/watchlist-empty.ts") && exists("src/lib/watchlist-empty.test.ts"), "heroEyebrow / watchlistExits live in src/lib with tests");
  const hero = read("src/components/watchlist/WatchlistHeroCompact.tsx");
  assert(hero.includes("eyebrow: string") && hero.includes("ranked ? (") && hero.includes("{eyebrow}</p>") && !hero.includes(">Próxima en tu lista<"), "Hero takes its eyebrow and only shows the orange «1» in manual order");
  assert(fichaRow.includes("sortedRankLabel(rank)") && fichaRow.includes("ranked ? ("), "Rows read «#n en tu orden» under a sort instead of the numeral");
  assert(cartelera.includes("heroEyebrow(sortQuery, hero.platform?.label)") && view.includes("watchlistExits(query, count, names)"), "Cartelera owns the eyebrow; 0 results offer exits with counts");
  assert(read("src/components/watchlist/WatchlistEmpty.tsx").includes("el que más recorta") && !read("src/components/watchlist/WatchlistEmpty.tsx").includes("Ya pasó tu hora de dormir"), "0 results: the best exit is highlighted; no «Esta noche» empty");
  assert(!page.includes("MinePlatformsEmpty") && !page.includes('title="Nada con ese filtro"'), "Page no longer renders its own empties: the cartelera does");
  assert(read("src/components/watchlist/WatchlistSheets.tsx").includes("platform={markTarget?.platform?.platform ?? undefined}"), "«Vi esto» opens with the row's platform");

  // Pulido (FIL-I24-5): Reordenar bar, 44 px controls, numeral, 48 px bar, broken poster plate.
  const bar = read("src/components/watchlist/WatchlistStickyBar.tsx");
  assert(bar.includes(">Reordenar<") && bar.includes("Mi orden") && bar.includes("flex h-12 items-center") && bar.includes("Filtros en pausa."), "Reordenar bar: «Reordenar · Mi orden», Listo, 48 px, says the filters are paused");
  assert(read("src/components/ListItemOrderControls.tsx").includes('size === "lg" ? "size-11" : "size-8"') && read("src/components/WatchlistCard.tsx").includes('size="lg"') && read("src/components/WatchlistCard.tsx").includes("inline-flex size-11 shrink-0 cursor-grab"), "Reordenar rows: 44×44 arrows and handle");
  assert(/\.ficha-rank \{[^}]*bottom: -10px/.test(css), "Numeral hangs 4 px lower with a denser shadow");
  assert(exists("src/components/PosterImageFallback.tsx") && read("src/components/PosterImageFallback.tsx").includes("onError={() => setBroken(true)}") && read("src/components/PosterImage.tsx").includes("PosterImageFallback"), "A broken poster falls back to the plate with the initial");

  // Escritorio (FIL-I24-6): no compact hero from 1024 px; the list starts at #1 and the stage is the hero.
  assert(cartelera.includes("const hero = isDesktop ? null : (visible[0] ?? null);") && cartelera.includes("const rows = isDesktop ? visible : visible.slice(1);"), "Desktop renders no WatchlistHeroCompact: the list starts at #1");
  assert(cartelera.includes("lead={isDesktop && index === 0 ? heroEyebrow(sortQuery, ficha.platform?.label) : null}") && fichaRow.includes("lead && ranked ? (") && fichaRow.includes("{lead}</span>"), "Desktop #1 row carries the eyebrow and the orange badge");
  assert(cartelera.includes("useWatchlistKeyboard({") && cartelera.includes("enabled: isDesktop && !isEditing && !sheetsOpen"), "↑↓ / Enter / V keep working on the desktop stage");

  // Después (FIL-I24-7): closing card and runtime in the lazy enrichment.
  assert(exists("src/components/watchlist/WatchlistClosingCard.tsx") && read("src/components/watchlist/WatchlistClosingCard.tsx").includes("Eso es todo") && read("src/components/watchlist/WatchlistClosingCard.tsx").includes('href="/buscar"'), "Closing card: «Eso es todo», total, fit count, Buscar más / Arriba");
  assert(cartelera.includes("<WatchlistClosingCard total={visible.length} fitCount={fitCount} />"), "The cartelera closes the list once");
  assert(read("src/lib/title-extras-core.ts").includes("export const titleNeedsRuntime") && read("src/lib/title-overview-hydrate.ts").includes("runtime && titleNeedsRuntime(title)") && page.includes("{ runtime: true }"), "Quiero ver's lazy enrichment also asks for the runtime");
  assert(read("src/lib/title-overview-hydrate.ts").includes("OVERVIEW_HYDRATE_LIMIT = 32"), "Same call cap as before");
  assert(read("docs/motion.md").includes("cartelera"), "Motion doc covers the cartelera");

  console.log("✓ Quiero ver · La cartelera: premios (0006 + OMDb + backfill), pin «Esta noche» en Hoy, fichas + gestos + escenario, Barra de decisión (FIL-I34)");
};

run();
