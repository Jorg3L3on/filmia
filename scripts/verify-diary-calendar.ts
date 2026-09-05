import {
  currentMonthParam,
  getMonthGrid,
  groupTitlesByWatchedDay,
  hasExplicitMonthParam,
  isValidIsoDate,
  latestMonthWithEntries,
  parseDayParam,
  parseMonthParam,
  shiftMonthParam,
  titlesInMonth,
  toDateInput,
  todayDateInput,
} from "../src/lib/dates";
import { catalogHref } from "../src/lib/tags";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = () => {
  const now = new Date(2026, 8, 3, 18, 0, 0);
  assert(todayDateInput(now) === "2026-09-03", "Local today should be YYYY-MM-DD");
  assert(currentMonthParam(now) === "2026-09", "Current month should be YYYY-MM");
  assert(parseMonthParam("2026-09", now) === "2026-09", "Valid month param is kept");
  assert(parseMonthParam("2026-13", now) === "2026-09", "Invalid month falls back to now");
  assert(parseMonthParam(undefined, now) === "2026-09", "Missing month falls back to now");
  assert(parseMonthParam(["2025-01", "2026-02"], now) === "2026-02", "Repeated month keeps last");
  assert(shiftMonthParam("2026-01", -1) === "2025-12", "January previous wraps the year");
  assert(shiftMonthParam("2025-12", 1) === "2026-01", "December next wraps the year");

  const sept = getMonthGrid("2026-09");
  const aug = getMonthGrid("2026-08");
  assert(sept.length === 35, "Sept 2026 fits in 5 weeks after trimming");
  assert(aug.length === 42, "August 2026 still needs 6 weeks");
  assert(sept[0]?.isoDate === "2026-08-31", "Sept 2026 starts on Monday Aug 31");
  assert(sept[1]?.isoDate === "2026-09-01" && sept[1]?.inMonth, "Sept 1 is in month");
  assert(sept[0]?.inMonth === false, "Leading August day is out of month");

  assert(isValidIsoDate("2026-09-03"), "Real calendar day is valid");
  assert(!isValidIsoDate("2026-02-31"), "Feb 31 is invalid");
  assert(parseDayParam("2026-09-03", "2026-09") === "2026-09-03", "Day in month is kept");
  assert(parseDayParam("2026-08-31", "2026-09") === null, "Day outside month is ignored");
  assert(parseDayParam("nope", "2026-09") === null, "Junk day is ignored");

  const titles = [
    {
      name: "Gladiator",
      watchedAt: new Date("2000-06-15T12:00:00.000Z"),
    },
    {
      name: "Troy",
      watchedAt: new Date("2004-06-15T12:00:00.000Z"),
    },
    {
      name: "Dune",
      watchedAt: new Date("2021-06-15T12:00:00.000Z"),
    },
    {
      name: "Same day",
      watchedAt: new Date("2021-06-15T12:00:00.000Z"),
    },
    { name: "Unwatched", watchedAt: null },
  ];

  const grouped = groupTitlesByWatchedDay(titles);
  assert(grouped.get("2000-06-15")?.length === 1, "Group by noon-UTC calendar day");
  assert(grouped.get("2021-06-15")?.map((item) => item.name).join(",") === "Dune,Same day", "Same day keeps both");
  assert(!grouped.has(""), "Null watchedAt is skipped");
  assert(toDateInput(titles[0]?.watchedAt) === "2000-06-15", "Stored noon UTC stays date-only");
  assert(titlesInMonth(titles, "2021-06").length === 2, "Month filter uses YYYY-MM prefix");
  assert(titlesInMonth(titles, "2026-09").length === 0, "Empty month has no titles");
  assert(!hasExplicitMonthParam(undefined), "Missing month is not explicit");
  assert(hasExplicitMonthParam("2021-06"), "Valid month is explicit");
  assert(
    latestMonthWithEntries(titles, "2026-09") === "2021-06",
    "Historial without month opens the latest watched month",
  );

  assert(
    catalogHref("/", { view: "calendar", month: "2026-09" }) ===
      "/?view=calendar&month=2026-09",
    "Calendar href should emit view and month",
  );
  assert(
    catalogHref("/", {
      view: "calendar",
      month: "2026-09",
      day: "2026-09-03",
      tags: ["sci-fi"],
      minePlatforms: true,
    }) === "/?tag=sci-fi&view=calendar&minePlatforms=1&month=2026-09&day=2026-09-03",
    "Calendar href should keep filters, month and day",
  );
  assert(
    catalogHref("/", { view: "grid", month: "2026-09", day: "2026-09-03" }) ===
      "/?view=grid&month=2026-09",
    "Day should not leak into non-calendar views; month stays for historial",
  );
  assert(
    catalogHref("/", { view: "calendar" }) === "/?view=calendar",
    "Calendar without month still sets view",
  );

  console.log("✓ Diary calendar month/day params, grouping and catalog hrefs");
};

run();
