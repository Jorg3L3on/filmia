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
  for (const file of ["src/lib/metadata.ts", "src/lib/add-title-from-tmdb.ts", "scripts/backfill-tonight.ts"]) {
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
  // Time of day: the «Esta noche» chip, filter and «te cabe» line only at night (same rule as Hoy).
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
  assert(read("docs/motion.md").includes("cartelera"), "Motion doc covers the cartelera");

  console.log("✓ Quiero ver · La cartelera: premios (0006 + OMDb + backfill), pin «Esta noche» en Hoy, fichas + gestos + escenario");
};

run();
