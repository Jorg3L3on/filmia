import { titleSynopsis } from "../src/lib/title-overview";

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

console.log("✓ Compact-row synopsis helper");
