/**
 * `npm run quiniela:nueva` (FIL-I51-9): the skeleton of a new ceremony file for an award without a
 * dataset (Globos de Oro, Emmy, BAFTA; the Óscar too when DLu does not have it yet). It writes every
 * main category of the award's template with no nominees; type them in from the official list, then
 * run `npm run quiniela:tmdb` and register the file in `src/lib/quinielas/ceremonies.ts` and its
 * dates in `src/lib/quinielas/seasons.ts`.
 *
 *   npm run quiniela:nueva -- --premio globos --año 2027 --nominaciones 2026-12-07 --ceremonia 2027-01-10 \
 *     [--edicion 84] [--fuente https://goldenglobes.com/…]
 */
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AWARDS, isAwardId } from "../src/lib/quinielas/awards";
import { skeletonCeremony, validateCeremonyFile } from "../src/lib/quinielas/ceremony-core";

const DIR = fileURLToPath(new URL("../src/data/quinielas/", import.meta.url));

const flag = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const main = async () => {
  const award = flag("premio");
  const year = Number(flag("año") ?? flag("ano"));
  const nominationsOn = flag("nominaciones") ?? "";
  const ceremonyOn = flag("ceremonia") ?? "";
  const edition = flag("edicion");
  if (!isAwardId(award)) {
    throw new Error(`--premio debe ser uno de: ${Object.keys(AWARDS).join(", ")}`);
  }
  if (!Number.isInteger(year)) {
    throw new Error("--año: el año en que se hace la ceremonia, p. ej. 2027");
  }
  const file = skeletonCeremony({
    award,
    year,
    edition: edition ? Number(edition) : null,
    nominationsOn,
    ceremonyOn,
    builtAt: new Date().toISOString().slice(0, 10),
    url: flag("fuente"),
  });
  const problems = validateCeremonyFile(file, { allowEmpty: true });
  if (problems.length > 0) {
    throw new Error(problems.join("\n"));
  }
  const out = `${DIR}${file.id}.json`;
  if (existsSync(out) && !process.argv.includes("--sobrescribir")) {
    throw new Error(`${out} ya existe (usa --sobrescribir para reemplazarlo)`);
  }
  await writeFile(out, `${JSON.stringify(file, null, 1)}\n`);
  console.log(`quinielas/${file.id}.json: ${file.categories.length} categorías vacías de ${AWARDS[award].name}.`);
  console.log("Siguiente: escribe las nominadas de la lista oficial, luego `npm run quiniela:tmdb -- " + out + "`.");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
