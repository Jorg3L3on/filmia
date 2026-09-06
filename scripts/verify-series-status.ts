import { TitleKind } from "../src/db";
import { parseSeriesSeason, parseSeriesStatus } from "../src/lib/form-data";
import { parseSeriesStatusFilter, titleMatchesSeriesStatus } from "../src/lib/series";
import { catalogHref } from "../src/lib/tags";

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
  const watching = { kind: TitleKind.SERIES, seriesStatus: "WATCHING" };
  const finished = { kind: TitleKind.SERIES, seriesStatus: "FINISHED" };
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
      tags: ["sci-fi"],
      minePlatforms: true,
      seriesStatus: "NONE",
    }) === "/?tag=sci-fi&minePlatforms=1&seriesStatus=NONE",
    "Catalog href should keep seriesStatus with other filters",
  );
  assert(
    catalogHref("/", { view: "deck" }) === "/",
    "Default catalog href without seriesStatus stays clean",
  );

  console.log("✓ Series status parse, movie ignore, and catalog hrefs");
};

run();
