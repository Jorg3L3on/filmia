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
  for (const file of ["src/lib/metadata.ts", "src/lib/add-title-from-tmdb.ts", "src/app/actions/titles.ts", "scripts/backfill-tonight.ts"]) {
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

  console.log("✓ Quiero ver · La cartelera: premios (0006 + OMDb + backfill), pin «Esta noche» en Hoy");
};

run();
