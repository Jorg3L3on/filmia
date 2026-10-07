import { SeriesStatus, TitleKind } from "../src/db";
import { parseSeriesSeason, parseSeriesStatus } from "../src/lib/form-data";
import { parseSeriesStatusFilter, titleMatchesSeriesStatus } from "../src/lib/series";
import { catalogHref } from "../src/lib/catalog-href";
import {
  DEFAULT_LISTS,
  emptyStateForList,
  isFixedListSlug,
  isReservedListSlug,
  partitionUserLists,
  SERIES_ABANDONADAS_NAME,
  SERIES_ABANDONADAS_SLUG,
  SERIES_EN_PROGRESO_NAME,
  SERIES_EN_PROGRESO_SLUG,
  SERIES_STATUS_LISTS,
} from "../src/lib/lists";
import { slugify } from "../src/lib/labels";
import { seriesStatusListTransition } from "../src/lib/series-status-lists";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = () => {
  assert(parseSeriesStatusFilter("WATCHING") === "WATCHING", "WATCHING filter");
  assert(parseSeriesStatusFilter("finished") === "FINISHED", "Case-insensitive FINISHED");
  assert(parseSeriesStatusFilter("DROPPED") === "DROPPED", "DROPPED filter");
  assert(parseSeriesStatusFilter("NONE") === "NONE", "NONE filter");
  assert(parseSeriesStatusFilter("movie") === undefined, "Unknown filter is ignored");
  assert(parseSeriesStatusFilter(undefined) === undefined, "Missing filter");
  assert(
    parseSeriesStatusFilter(["WATCHING", "DROPPED"]) === "DROPPED",
    "Repeated params keep the last value",
  );

  const movie = { kind: TitleKind.MOVIE, seriesStatus: null };
  const watching = { kind: TitleKind.SERIES, seriesStatus: SeriesStatus.WATCHING };
  const finished = { kind: TitleKind.SERIES, seriesStatus: SeriesStatus.FINISHED };
  const unset = { kind: TitleKind.SERIES, seriesStatus: null };

  assert(titleMatchesSeriesStatus(movie, undefined), "No filter matches movies");
  assert(!titleMatchesSeriesStatus(movie, "WATCHING"), "Movies ignore WATCHING");
  assert(!titleMatchesSeriesStatus(movie, "NONE"), "Movies ignore NONE");
  assert(titleMatchesSeriesStatus(watching, "WATCHING"), "Watching series matches");
  assert(!titleMatchesSeriesStatus(finished, "WATCHING"), "Finished series excluded");
  assert(titleMatchesSeriesStatus(unset, "NONE"), "Unset series matches NONE");
  assert(!titleMatchesSeriesStatus(watching, "NONE"), "Watching series excluded from NONE");

  const form = new FormData();
  form.set("seriesStatus", "WATCHING");
  form.set("seriesSeason", "2");
  assert(parseSeriesStatus(form.get("seriesStatus")) === "WATCHING", "Form status");
  assert(parseSeriesSeason(form.get("seriesSeason")) === 2, "Form season");
  assert(parseSeriesStatus("NONE") === null, "Form NONE clears status");
  assert(parseSeriesSeason("") === null, "Empty season is null");

  let threw = false;
  try {
    parseSeriesSeason("0");
  } catch {
    threw = true;
  }
  assert(threw, "Season 0 is invalid");

  assert(
    catalogHref("/", { seriesStatus: "WATCHING", view: "grid" }) ===
      "/?view=grid&seriesStatus=WATCHING",
    "Catalog href should emit seriesStatus",
  );
  assert(
    catalogHref("/", {
      minePlatforms: true,
      seriesStatus: "NONE",
    }) === "/?minePlatforms=1&seriesStatus=NONE",
    "Catalog href should keep seriesStatus with other filters",
  );
  assert(
    catalogHref("/", { view: "deck" }) === "/",
    "Default catalog href without seriesStatus stays clean",
  );

  // Listas automáticas por estado (issue #109).
  assert(SERIES_EN_PROGRESO_NAME === "Series en progreso", "En progreso list name");
  assert(SERIES_ABANDONADAS_NAME === "Series abandonadas", "Abandonadas list name");
  for (const list of SERIES_STATUS_LISTS) {
    assert(slugify(list.name) === list.slug, `${list.name} slug matches its name`);
    assert(isFixedListSlug(list.slug), `${list.name} is a fixed list`);
    assert(isReservedListSlug(list.slug), `${list.name} name is reserved`);
    assert(
      !DEFAULT_LISTS.some((defaults) => defaults.slug === list.slug),
      `${list.name} is provisioned lazily, not with the default lists`,
    );
    assert(
      emptyStateForList(list.slug).title !== emptyStateForList(null).title,
      `${list.name} has its own empty state`,
    );
  }

  const toWatching = seriesStatusListTransition(null, "WATCHING");
  assert(toWatching.join === SERIES_EN_PROGRESO_SLUG, "Viendo joins En progreso");
  assert(
    toWatching.leave.length === 1 && toWatching.leave[0] === SERIES_ABANDONADAS_SLUG,
    "Viendo leaves Abandonadas",
  );
  const toDropped = seriesStatusListTransition("WATCHING", "DROPPED");
  assert(toDropped.join === SERIES_ABANDONADAS_SLUG, "Abandonada joins Abandonadas");
  assert(toDropped.leave.includes(SERIES_EN_PROGRESO_SLUG), "Abandonada leaves En progreso");
  const toFinished = seriesStatusListTransition("DROPPED", "FINISHED");
  assert(toFinished.join === null, "Terminada has no list");
  assert(toFinished.leave.length === 2, "Terminada leaves both status lists");
  const cleared = seriesStatusListTransition("WATCHING", null);
  assert(cleared.join === null && cleared.leave.length === 2, "Clearing leaves both lists");
  const repeated = seriesStatusListTransition("DROPPED", "DROPPED");
  assert(
    repeated.join === SERIES_ABANDONADAS_SLUG && !repeated.leave.includes(SERIES_ABANDONADAS_SLUG),
    "Repeating the status keeps the same list",
  );

  const { fixed, custom } = partitionUserLists([
    { slug: null, name: "Series abandonadas" },
    { slug: SERIES_ABANDONADAS_SLUG, name: SERIES_ABANDONADAS_NAME },
    { slug: "watchlist", name: "Quiero ver" },
  ]);
  assert(
    fixed.map((list) => list.slug).join(",") === `watchlist,${SERIES_ABANDONADAS_SLUG}`,
    "Status lists sit in the daily rail after the default lists",
  );
  assert(
    custom.length === 1 && custom[0].slug === null,
    "A same-named custom list stays among the custom lists",
  );

  console.log("✓ Series status parse, movie ignore, catalog hrefs, and status lists");
};

run();
