import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectLatestWeek,
  dedupeShows,
  expectedLatestWeekEnd,
  isOfficialListUsable,
  matchCandidates,
  nextOfficialDay,
  normalizeTitle,
  officialWeekLabel,
  parseTop10Header,
  parseTop10Line,
  streamLines,
  weekStartOf,
} from "./netflix-top10";
import { chartHeading, chartSourceLine } from "./service-charts";

const HEADER = "country_name\tcountry_iso2\tweek\tcategory\tweekly_rank\tshow_title\tseason_title\tcumulative_weeks_in_top_10";
const line = (iso: string, week: string, category: string, rank: number, show: string, season = "N/A", weeks = 1) =>
  [iso === "MX" ? "Mexico" : "Argentina", iso, week, category, rank, show, season, weeks].join("\t");

async function* lines(values: string[]) {
  for (const value of values) yield value;
}

describe("Netflix TSV", () => {
  it("keeps only Mexico rows, maps Films / TV and reads seasons and weeks", () => {
    const header = parseTop10Header(HEADER)!;
    assert.equal(parseTop10Line(line("AR", "2026-11-08", "Films", 1, "X"), header), null);
    assert.equal(parseTop10Line(line("MX", "2026-11-08", "Shorts", 1, "X"), header), null);
    assert.deepEqual(parseTop10Line(line("MX", "2026-11-08", "TV", 6, "Lupin", "Lupin: Part 4", 2), header), {
      week: "2026-11-08",
      kind: "SERIES",
      rank: 6,
      showTitle: "Lupin",
      seasonTitle: "Lupin: Part 4",
      weeks: 2,
    });
    assert.equal(parseTop10Line(line("MX", "2026-11-08", "Films", 1, "Sing 2", "N/A", 20), header)?.seasonTitle, null);
  });

  it("refuses a file whose header changed", () => {
    assert.equal(parseTop10Header("country\tweek"), null);
  });

  it("keeps only the latest Mexico week, films before series, by rank", async () => {
    const rows = await collectLatestWeek(
      lines([
        HEADER,
        line("AR", "2026-11-15", "Films", 1, "Other country"),
        line("MX", "2026-11-08", "TV", 2, "B"),
        line("MX", "2026-11-08", "Films", 2, "D"),
        line("MX", "2026-11-01", "Films", 1, "Old"),
        line("MX", "2026-11-08", "Films", 1, "C"),
      ]),
    );
    assert.deepEqual(rows.map((row) => `${row.week}:${row.kind}:${row.rank}:${row.showTitle}`), [
      "2026-11-08:MOVIE:1:C",
      "2026-11-08:MOVIE:2:D",
      "2026-11-08:SERIES:2:B",
    ]);
  });

  it("splits a byte stream into lines across chunk borders", async () => {
    const encoder = new TextEncoder();
    async function* chunks() {
      yield encoder.encode("a\tb\nc");
      yield encoder.encode("d\r\ne");
    }
    const out: string[] = [];
    for await (const value of streamLines(chunks())) out.push(value);
    assert.deepEqual(out, ["a\tb", "cd", "e"]);
  });

  it("keeps one entry per show with its best rank", () => {
    const header = parseTop10Header(HEADER)!;
    const rows = [5, 6, 9].map((rank) => parseTop10Line(line("MX", "2026-11-08", "TV", rank, "Lupin", `Lupin: Part ${rank}`), header)!);
    assert.deepEqual(dedupeShows(rows).map((row) => row.rank), [5]);
  });
});

describe("title matching", () => {
  const hits = [
    { tmdbId: 1, enName: "Thanksgiving Day", originalName: null, popularity: 90 },
    { tmdbId: 2, enName: "Thanksgiving", originalName: "Thanksgiving", popularity: 40 },
    { tmdbId: 3, enName: "Thanksgiving", originalName: null, popularity: 70 },
    { tmdbId: 4, enName: "Odna", originalName: "The One", popularity: 10 },
  ];

  it("takes only exact (normalized) names, most popular first", () => {
    assert.deepEqual(matchCandidates("Thanksgiving", hits).map((hit) => hit.tmdbId), [3, 2]);
    assert.deepEqual(matchCandidates("The One", hits).map((hit) => hit.tmdbId), [4]);
    assert.deepEqual(matchCandidates("Something else", hits), []);
  });

  it("normalizes accents, articles, ampersands and punctuation", () => {
    assert.equal(normalizeTitle("The Fall of El Mayo"), normalizeTitle("Fall of El Mayo"));
    assert.equal(normalizeTitle("Sniper: The Last Stand"), "sniper last stand");
    assert.equal(normalizeTitle("Love & Death"), normalizeTitle("Love and Death"));
    assert.equal(normalizeTitle("Pokémon"), "pokemon");
  });
});

describe("official list fallback and label", () => {
  it("needs six matched titles; below that the list stays «Lo más popular»", () => {
    assert.equal(isOfficialListUsable(5), false);
    assert.equal(isOfficialListUsable(6), true);
    const source = isOfficialListUsable(5) ? "official" : "popularity";
    assert.equal(chartHeading("NETFLIX", source), "Lo más popular en Netflix");
  });

  it("labels the official list with its week", () => {
    assert.equal(weekStartOf("2026-11-08"), "2026-11-02");
    assert.equal(officialWeekLabel("2026-11-02"), "semana del 2 al 8 de noviembre");
    assert.equal(officialWeekLabel("2026-10-27"), "semana del 27 de octubre al 2 de noviembre");
    assert.equal(chartSourceLine("NETFLIX", "official", "2026-11-02"), "Lista oficial de Netflix · semana del 2 al 8 de noviembre");
    assert.equal(chartHeading("NETFLIX", "official"), "Top 10 en México");
  });

  it("knows which week should be out (Tuesday publication)", () => {
    assert.equal(expectedLatestWeekEnd("2026-11-10"), "2026-11-08"); // Tuesday
    assert.equal(expectedLatestWeekEnd("2026-11-09"), "2026-11-01"); // Monday: not out yet
    assert.equal(expectedLatestWeekEnd("2026-11-08"), "2026-11-01"); // Sunday
    assert.equal(expectedLatestWeekEnd("2026-11-14"), "2026-11-08"); // Saturday
  });

  it("names the next Tuesday", () => {
    assert.equal(nextOfficialDay("2026-11-10"), "2026-11-17");
    assert.equal(nextOfficialDay("2026-11-12"), "2026-11-17");
    assert.equal(nextOfficialDay("2026-11-16"), "2026-11-17");
  });
});
