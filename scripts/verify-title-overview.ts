import {
  compactGenreLabel,
  titleOverviewMap,
  titleSynopsis,
} from "../src/lib/title-overview";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

assert(titleSynopsis(null) === null, "Null overview should hide the compact synopsis");
assert(titleSynopsis("   ") === null, "Whitespace overview should hide the compact synopsis");
assert(
  titleSynopsis("  Un grupo de exploradores viaja.  ") ===
    "Un grupo de exploradores viaja.",
  "Synopsis should trim stored overview",
);

assert(compactGenreLabel([]) === null, "Empty genres omit the compact label");
assert(compactGenreLabel(null) === null, "Null genres omit the compact label");
assert(
  compactGenreLabel([{ id: 18, name: "Drama" }]) === "Drama",
  "One genre renders without a separator",
);
assert(
  compactGenreLabel([
    { id: 18, name: "Drama" },
    { id: 53, name: "Suspense" },
  ]) === "Drama · Suspense",
  "Two genres join with a middot",
);
assert(
  compactGenreLabel([
    { id: 18, name: "Drama" },
    { id: 53, name: "Suspense" },
    { id: 80, name: "Crimen" },
  ]) === "Drama · Suspense…",
  "A third genre collapses to an ellipsis",
);

const shared = {
  id: "t1",
  tmdbId: 1,
  kind: "MOVIE" as const,
  overview: "  Cached  ",
  tmdbGenres: [],
};
const mapped = titleOverviewMap([shared]);
assert(mapped.get("t1") === "Cached", "Overview map trims stored text");
shared.overview = "Mutated in place";
assert(mapped.get("t1") === "Cached", "Overview map snapshots the trimmed value");

console.log("✓ Compact-row synopsis and genre helpers");
