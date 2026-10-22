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
  assert(omdb.includes("Awards") && omdb.includes('"v2"') && omdb.includes("imdbVotes"), "OMDb keeps Awards and bumped its cache key");
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
  // Time of day: the «Esta noche» chip, filter and «termina a tiempo» line only at night (same rule as Hoy).
  assert(read("src/components/watchlist/WatchlistFilterRail.tsx").includes("isNight(now, nightEnds)"), "Rail hides «Esta noche» by day");
  assert(read("src/components/watchlist/WatchlistCartelera.tsx").includes("isNight(now, nightEnds)"), "Cartelera ignores «Esta noche» by day");
  assert(read("src/components/watchlist/useFichaViews.ts").includes("isNight(now, nightEnds)"), "Ficha fit only computed at night");

  // The cartelera itself.
  const components = [
    "WatchlistCartelera", "WatchlistFicha", "WatchlistFichaDetail", "WatchlistFichaChips", "WatchlistHookLine",
    "WatchlistHeroCompact", "WatchlistFichaMenu", "WatchlistNoteSheet", "WatchlistFilterRail", "WatchlistGenreSheet",
    "WatchlistReorderList", "WatchlistStickyBar", "WatchlistCountTicker", "WatchlistStage", "WatchlistSwipeLayer",
  ];
  for (const name of components) {
    const file = `src/components/watchlist/${name}.tsx`;
    assert(exists(file), `${file} exists`);
    assert(read(file).split("\n").length < 300, `${file} stays under 300 lines`);
  }
  for (const old of ["WatchlistList", "WatchlistHero", "WatchlistGrid", "WatchlistMarkSeenButton", "PosterPlatformBadge"]) {
    assert(!exists(`src/components/${old}.tsx`), `${old} replaced by the cartelera`);
  }
  const page = read("src/app/watchlist/page.tsx");
  assert(page.includes("WatchlistCartelera") && page.includes("getCurrentUserProfile") && page.includes("tonightOnly"), "Page wires the cartelera with the bedtime");
  assert(page.includes("WatchlistFilterRail") && page.includes("extraQuery"), "Rail chips ride inside CatalogFilters and the Filtros sheet keeps them");
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

  // Compact header on the phone (FIL-I21-7): title + count on the Filtros row, round Reordenar and Filtros, one chip row.
  const filters = read("src/components/CatalogFilters.tsx");
  assert(filters.includes("heading?: ReactNode") && filters.includes("headingActions?: ReactNode") && filters.includes("compactOnMobile={compact}") && filters.includes("max-sm:[grid-area:2/1/3/4]"), "CatalogFilters folds the title into the Filtros row and gives the rail its own row on the phone");
  assert(page.includes("WatchlistEditingProvider") && page.includes("headingActions={<WatchlistReorderButton />}") && page.includes("WatchlistCompactTitle count={items.length}") && page.includes('className="hidden sm:block"'), "Page: compact title with the count, round Reordenar, desktop title untouched");
  const editing = read("src/components/watchlist/WatchlistEditing.tsx");
  assert(editing.includes('"Reordenar la lista"') && editing.includes("aria-pressed") && editing.includes("glassIconClass"), "Round Reordenar button with aria");
  assert(read("src/components/CatalogMoreFilters.tsx").includes('aria-label={') && read("src/components/CatalogMoreFilters.tsx").includes("max-sm:size-8"), "Filtros is a round icon button on the phone, labelled");
  const cartelera = read("src/components/watchlist/WatchlistCartelera.tsx");
  assert(cartelera.includes("useWatchlistEditing()") && cartelera.includes('sharedEditing && !isEditing ? "max-sm:hidden"'), "Cartelera shares reorder mode and hides the old count/Reordenar bar on the phone unless editing");
  assert(read("src/components/watchlist/WatchlistFilterRail.tsx").includes("filter-rail-fade") && css.includes(".filter-rail-fade"), "Single chip row scrolls with a fade at the end");

  // Riel A «Un riel que se ve» (FIL-I24-3): 36/44 px chips, counts on Cortas/Premiadas, 48 px fade + disc, one badge.
  const rail = read("src/components/watchlist/WatchlistFilterRail.tsx");
  assert(rail.includes("rail-chip") && css.includes(".rail-chip::before") && /\.rail-chip \{[^}]*height: 36px/.test(css), "Rail chips: 36 px visible with a ::before touch area");
  assert(rail.includes("counts.short") && rail.includes("counts.awarded") && rail.includes("aria-disabled") && rail.includes("rail-chip-empty"), "Cortas / Premiadas carry their counts and go inert at 0");
  assert(rail.includes("`Orden · ${sortLabel}`") && rail.includes("chevron") && rail.includes('"Mi orden"'), "Sort button: «Mi orden» with a chevron, «Orden · X» when active");
  assert(rail.includes('data-overflow') && rail.includes("rail-more") && css.includes('.filter-rail-fade[data-overflow="right"]') && css.includes("calc(100% - 48px)"), "48 px fade and «›» disc only while the rail overflows to the right");
  assert(!/\.filter-rail-fade > button:first-child/.test(css), "The old 30 px first-button rule is gone");
  assert(page.includes("minePlatformsInBar") && read("src/components/CatalogFilters.tsx").includes("minePlatformsInBar && minePlatforms ? 1 : 0"), "Filtros badge no longer counts «Mis plataformas» when the rail owns the chip");
  assert(page.includes("applyWatchlistFilters(rawItems, { short: true }).length") && page.includes("applyWatchlistFilters(rawItems, { awarded: true }).length"), "Counts come from applyWatchlistFilters over the whole list");

  // Piezas (FIL-I24-4): truthful eyebrow under a sort, one empty state that names the chip, platform in «Vi esto».
  assert(exists("src/lib/watchlist-empty.ts") && exists("src/lib/watchlist-empty.test.ts"), "heroEyebrow / watchlistEmptyState live in src/lib with tests");
  const hero = read("src/components/watchlist/WatchlistHeroCompact.tsx");
  assert(hero.includes("eyebrow: string") && hero.includes("ranked ? (") && hero.includes("{eyebrow}</p>") && !hero.includes(">Próxima en tu lista<"), "Hero takes its eyebrow and only shows the orange «1» in manual order");
  assert(fichaRow.includes("sortedRankLabel(rank)") && fichaRow.includes("ranked ? ("), "Rows read «#n en tu orden» under a sort instead of the numeral");
  assert(cartelera.includes("heroEyebrow(sort, hero.platform?.label)") && cartelera.includes("WatchlistEmpty") && cartelera.includes("watchlistEmptyState(pathname, query"), "Cartelera owns the eyebrow and the single empty state");
  assert(exists("src/components/watchlist/WatchlistEmpty.tsx") && read("src/components/watchlist/WatchlistEmpty.tsx").includes("Ya pasó tu hora de dormir") && read("src/components/watchlist/WatchlistEmpty.tsx").includes("/perfil#hora-de-dormir"), "«Esta noche» past bedtime says so and offers «Cambiar hora»");
  assert(!page.includes("MinePlatformsEmpty") && !page.includes('title="Nada con ese filtro"'), "Page no longer renders its own empties: the cartelera does");
  assert(cartelera.includes('reorderBlocked={!canReorder && visible.length > 1 ? (sort ? "sort" : "filters") : null}'), "Sticky bar says whether a sort or a filter blocks reordering");
  assert(read("src/components/watchlist/WatchlistSheets.tsx").includes("platform={markTarget?.platform?.platform ?? undefined}"), "«Vi esto» opens with the row's platform");

  // Pulido (FIL-I24-5): Reordenar bar, 44 px controls, numeral, 48 px bar, broken poster plate.
  const bar = read("src/components/watchlist/WatchlistStickyBar.tsx");
  assert(bar.includes('{isEditing ? "Reordenar" : "Quiero ver"}') && bar.includes("normal-case tracking-normal") && bar.includes("flex h-12 items-center"), "Sticky bar: «Reordenar» title, one quiet hint line, 48 px tall");
  assert(read("src/components/ListItemOrderControls.tsx").includes('size === "lg" ? "size-11" : "size-8"') && read("src/components/WatchlistCard.tsx").includes('size="lg"') && read("src/components/WatchlistCard.tsx").includes("inline-flex size-11 shrink-0 cursor-grab"), "Reordenar rows: 44×44 arrows and handle");
  assert(/\.ficha-rank \{[^}]*bottom: -10px/.test(css), "Numeral hangs 4 px lower with a denser shadow");
  assert(exists("src/components/PosterImageFallback.tsx") && read("src/components/PosterImageFallback.tsx").includes("onError={() => setBroken(true)}") && read("src/components/PosterImage.tsx").includes("PosterImageFallback"), "A broken poster falls back to the plate with the initial");
  assert(read("docs/motion.md").includes("cartelera"), "Motion doc covers the cartelera");

  console.log("✓ Quiero ver · La cartelera: premios (0006 + OMDb + backfill), pin «Esta noche» en Hoy, fichas + gestos + escenario");
};

run();
