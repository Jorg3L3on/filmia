/**
 * `npm run quiniela:tmdb -- <file>` (FIL-I51-9): fills a ceremony file's TMDB fields (id, Mexican
 * title, poster; people's id and photo) by IMDb id or by searching the title, films and series. Needs
 * TMDB_API_KEY in the environment. Prints what it could not find, so it can be fixed by hand, and
 * checks the file with the validator.
 *
 *   npm run quiniela:tmdb -- src/data/quinielas/globos-2027.json
 */
import { readFile, writeFile } from "node:fs/promises";
import type { QuinielaCeremonyFile } from "../src/lib/quinielas/ceremony-core";
import { validateCeremonyFile } from "../src/lib/quinielas/ceremony-core";
import { fillCeremonyFromTmdb } from "../src/lib/quinielas/tooling";

const main = async () => {
  const path = process.argv[2];
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!path) {
    throw new Error("Uso: npm run quiniela:tmdb -- src/data/quinielas/<entrega>.json");
  }
  if (!apiKey) {
    throw new Error("Falta TMDB_API_KEY en el entorno.");
  }
  const file = JSON.parse(await readFile(path, "utf8")) as QuinielaCeremonyFile;
  const report = await fillCeremonyFromTmdb(file, apiKey);
  await writeFile(path, `${JSON.stringify(file, null, 1)}\n`);
  console.log(`${file.id}: ${report.filled} obras completadas con ${report.lookups} consultas a TMDB.`);
  if (report.missing.length > 0) {
    console.warn(`Sin encontrar (${report.missing.length}), revisa a mano:\n  ${report.missing.join("\n  ")}`);
  }
  const problems = validateCeremonyFile(file);
  if (problems.length > 0) {
    console.warn(`El validador encontró:\n  ${problems.join("\n  ")}`);
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
