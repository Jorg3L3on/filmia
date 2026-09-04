import { SeriesStatus, TitleKind } from "../src/generated/prisma/browser";
import { parseSeriesSeason, parseSeriesStatus } from "../src/lib/form-data";
import {
  parseSeriesStatusFilter,
  seriesStatusWhere,
  titleMatchesSeriesStatus,
} from "../src/lib/series";
import { catalogHref } from "../src/lib/tags";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = () => {
  assert(parseSeriesStatusFilter("WATCHING") === SeriesStatus.WATCHING, "WATCHING filter");
  assert(parseSeriesStatusFilter("finished") === SeriesStatus.FINISHED, "Case-insensitive FINISHED");
  assert(parseSeriesStatusFilter("DROPPED") === SeriesStatus.DROPPED, "DROPPED filter");
  assert(parseSeriesStatusFilter("NONE") === "NONE", "NONE filter");
  assert(parseSeriesStatusFilter("movie") === undefined, "Unknown filter is ignored");
  assert(parseSeriesStatusFilter(undefined) === undefined, "Missing filter");
  assert(
    parseSeriesStatusFilter(["WATCHING", "DROPPED"]) === SeriesStatus.DROPPED,
    "Repeated params keep the last value",
  );

  const movie = { kind: TitleKind.MOVIE, seriesStatus: null };
  const watching = { kind: TitleKind.SERIES, seriesStatus: SeriesStatus.WATCHING };
  const finished = { kind: TitleKind.SERIES, seriesStatus: SeriesStatus.FINISHED };
  const unset = { kind: TitleKind.SERIES, seriesStatus: null };

  assert(titleMatchesSeriesStatus(movie, undefined), "No filter matches movies");
  assert(!titleMatchesSeriesStatus(movie, SeriesStatus.WATCHING), "Movies ignore WATCHING");
  assert(!titleMatchesSeriesStatus(movie, "NONE"), "Movies ignore NONE");
  assert(titleMatchesSeriesStatus(watching, SeriesStatus.WATCHING), "Watching series matches");
  assert(!titleMatchesSeriesStatus(finished, SeriesStatus.WATCHING), "Finished series excluded");
  assert(titleMatchesSeriesStatus(unset, "NONE"), "Unset series matches NONE");
  assert(!titleMatchesSeriesStatus(watching, "NONE"), "Watching series excluded from NONE");

  assert(
    JSON.stringify(seriesStatusWhere(undefined)) === "{}",
    "No filter should not constrain Prisma where",
  );
  assert(
    JSON.stringify(seriesStatusWhere(SeriesStatus.WATCHING)) ===
      JSON.stringify({ kind: TitleKind.SERIES, seriesStatus: SeriesStatus.WATCHING }),
    "WATCHING where is series-only",
  );
  assert(
    JSON.stringify(seriesStatusWhere("NONE")) ===
      JSON.stringify({ kind: TitleKind.SERIES, seriesStatus: null }),
    "NONE where is series with null status",
  );

  const form = new FormData();
  form.set("seriesStatus", "WATCHING");
  form.set("seriesSeason", "2");
  assert(parseSeriesStatus(form.get("seriesStatus")) === SeriesStatus.WATCHING, "Form status");
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
    catalogHref("/", { seriesStatus: SeriesStatus.WATCHING, view: "grid" }) ===
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

  console.log("✓ Series status parse, movie ignore, Prisma where and catalog hrefs");
};

run();
