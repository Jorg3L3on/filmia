/**
 * `npm run oscars:build` (FIL-I43): DLu/oscar_data `oscars.csv` at the pinned sha →
 * `src/data/oscars-by-person.json`, keyed by IMDb `nm` id.
 *
 * Data: https://github.com/DLu/oscar_data (BSD-2-Clause, © David V. Lu!!), compiled from the Academy
 * Awards Database (https://awardsdatabase.oscars.org). Rebuild once a year, after each ceremony: bump
 * OSCAR_DATA_SHA in `src/lib/oscars-core.ts`, run this, then `npm test` (it flags new categories).
 *
 *   npm run oscars:build                  # downloads the pinned file
 *   npm run oscars:build -- path/to.tsv   # builds from a local copy
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { OSCAR_DATA_REPO, OSCAR_DATA_SHA, parseOscarsTsv } from "../src/lib/oscars-core";

const SOURCE_URL = `https://raw.githubusercontent.com/${OSCAR_DATA_REPO}/${OSCAR_DATA_SHA}/oscars.csv`;
const OUT = fileURLToPath(new URL("../src/data/oscars-by-person.json", import.meta.url));
// Every nomination is kept since FIL-I45-1 (the person view draws one ticket per nomination).
const MAX_BYTES = 1536 * 1024;

const load = async (localPath: string | undefined) => {
  if (localPath) {
    return readFile(localPath, "utf8");
  }
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`${SOURCE_URL}: HTTP ${response.status}`);
  }
  return response.text();
};

const main = async () => {
  const text = await load(process.argv[2]);
  const index = parseOscarsTsv(text, {
    repo: OSCAR_DATA_REPO,
    sha: OSCAR_DATA_SHA,
    builtAt: new Date().toISOString().slice(0, 10),
  });
  // Stable key order keeps the yearly diff readable.
  const people = Object.fromEntries(Object.entries(index.people).sort(([a], [b]) => a.localeCompare(b)));
  const json = JSON.stringify({ source: index.source, people });
  const bytes = Buffer.byteLength(json);
  if (bytes > MAX_BYTES) {
    throw new Error(`oscars-by-person.json is ${bytes} bytes, over the ${MAX_BYTES} budget`);
  }
  await writeFile(OUT, `${json}\n`);
  const all = Object.values(people);
  console.log(
    `oscars-by-person.json: ${all.length} people, ${all.filter((p) => p.w?.length).length} winners, ` +
      `${all.reduce((sum, p) => sum + (p.w?.length ?? 0), 0)} wins, ` +
      `${all.reduce((sum, p) => sum + (p.x?.length ?? 0), 0)} lost nominations, ceremonies ${index.source.ceremonies.join("–")}, ` +
      `${(bytes / 1024).toFixed(0)} KB`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
