/**
 * `npm run oscars:build` (FIL-I43, FIL-I51): DLu/oscar_data `oscars.csv` at the pinned sha →
 * `src/data/oscars-by-person.json`, keyed by IMDb `nm` id, and, with `--entrega <year>`, the ballot
 * of that ceremony for the quinielas, `src/data/quinielas/oscar-<year>.json` (FIL-I51).
 *
 * Data: https://github.com/DLu/oscar_data (BSD-2-Clause, © David V. Lu!!), compiled from the Academy
 * Awards Database (https://awardsdatabase.oscars.org). Rebuild once a year, after each ceremony: bump
 * OSCAR_DATA_SHA in `src/lib/oscars-core.ts`, run this, then `npm test` (it flags new categories).
 * The quiniela needs the new nominees in January: when the dataset does not have them yet, start
 * the file with `npm run quiniela:nueva -- --premio oscar …` and type them in (`QuinielaCeremonyFile`).
 *
 * With TMDB_API_KEY set, each nominee gets its TMDB id, Mexican title, poster and, for people, a
 * profile photo; without it the app looks them up when it reads the file.
 *
 *   npm run oscars:build                                   # downloads the pinned file
 *   npm run oscars:build -- path/to.tsv                    # builds from a local copy
 *   npm run oscars:build -- path/to.tsv --entrega 2024 --nominaciones 2024-01-23 --ceremonia 2024-03-10
 *   npm run oscars:build -- --solo-entrega --entrega 2024 --nominaciones … --ceremonia …  # ballot only
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { OSCAR_DATA_REPO, OSCAR_DATA_SHA, parseOscarsTsv } from "../src/lib/oscars-core";
import {
  buildOscarCeremony,
  validateCeremonyFile,
  type QuinielaCeremonyFile,
} from "../src/lib/quinielas/ceremony-core";

const SOURCE_URL = `https://raw.githubusercontent.com/${OSCAR_DATA_REPO}/${OSCAR_DATA_SHA}/oscars.csv`;
const OUT = fileURLToPath(new URL("../src/data/oscars-by-person.json", import.meta.url));
const CEREMONIES_DIR = fileURLToPath(new URL("../src/data/quinielas/", import.meta.url));
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

const parseArgs = (argv: string[]) => {
  let path: string | undefined;
  let year: number | undefined;
  let ballotOnly = false;
  let nominationsOn = "";
  let ceremonyOn = "";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--nominaciones") {
      nominationsOn = argv[(i += 1)] ?? "";
    } else if (arg === "--ceremonia") {
      ceremonyOn = argv[(i += 1)] ?? "";
    } else if (arg === "--entrega") {
      year = Number(argv[(i += 1)]);
      if (!Number.isInteger(year) || year < 1929) {
        throw new Error("--entrega needs the year the ceremony is held, e.g. 2024");
      }
    } else if (arg === "--solo-entrega") {
      ballotOnly = true;
    } else {
      path = arg;
    }
  }
  if (ballotOnly && !year) {
    throw new Error("--solo-entrega needs --entrega <year>");
  }
  if (year && !(/^\d{4}-\d{2}-\d{2}$/.test(nominationsOn) && /^\d{4}-\d{2}-\d{2}$/.test(ceremonyOn))) {
    throw new Error("--entrega needs --nominaciones YYYY-MM-DD and --ceremonia YYYY-MM-DD (official dates)");
  }
  return { path, year, ballotOnly, nominationsOn, ceremonyOn };
};

const buildPeople = async (text: string, builtAt: string) => {
  const index = parseOscarsTsv(text, { repo: OSCAR_DATA_REPO, sha: OSCAR_DATA_SHA, builtAt });
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

type TmdbFind = {
  movie_results?: { id: number; title?: string | null; poster_path?: string | null }[];
  person_results?: { id: number; profile_path?: string | null }[];
};

/** TMDB `/find` by IMDb id, es-MX. Plain fetch: this runs outside Next. */
const tmdbFind = async (apiKey: string, imdbId: string): Promise<TmdbFind> => {
  const url = new URL(`https://api.themoviedb.org/3/find/${imdbId}`);
  url.searchParams.set("external_source", "imdb_id");
  url.searchParams.set("language", "es-MX");
  url.searchParams.set("api_key", apiKey);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB /find/${imdbId}: HTTP ${response.status}`);
  }
  return (await response.json()) as TmdbFind;
};

const enrichWithTmdb = async (file: QuinielaCeremonyFile, apiKey: string) => {
  const seen = new Map<string, TmdbFind>();
  const find = async (imdbId: string) => {
    if (!seen.has(imdbId)) {
      seen.set(imdbId, await tmdbFind(apiKey, imdbId));
    }
    return seen.get(imdbId)!;
  };
  let missing = 0;
  for (const category of file.categories) {
    for (const nominee of category.nominees) {
      if (nominee.work.imdbId) {
        const movie = (await find(nominee.work.imdbId)).movie_results?.[0];
        if (movie) {
          nominee.work.tmdbId = movie.id;
          nominee.work.titleEs = movie.title?.trim() || null;
          nominee.work.posterPath = movie.poster_path ?? null;
        } else {
          missing += 1;
        }
      }
      if (nominee.person?.imdbId) {
        const person = (await find(nominee.person.imdbId)).person_results?.[0];
        if (person) {
          nominee.person.tmdbId = person.id;
          nominee.person.profilePath = person.profile_path ?? null;
        }
      }
    }
  }
  console.log(`TMDB: ${seen.size} lookups, ${missing} films without a TMDB match`);
};

const buildCeremony = async (
  text: string,
  input: { year: number; nominationsOn: string; ceremonyOn: string },
  builtAt: string,
) => {
  const file = buildOscarCeremony(text, { ...input, source: { repo: OSCAR_DATA_REPO, sha: OSCAR_DATA_SHA, builtAt } });
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (apiKey) {
    await enrichWithTmdb(file, apiKey);
  } else {
    console.log("TMDB_API_KEY not set: the ballot file has no TMDB fields (the app looks them up).");
  }
  await mkdir(CEREMONIES_DIR, { recursive: true });
  await writeFile(`${CEREMONIES_DIR}${file.id}.json`, `${JSON.stringify(file, null, 1)}\n`);
  const nominees = file.categories.reduce((sum, category) => sum + category.nominees.length, 0);
  console.log(`quinielas/${file.id}.json: ceremony ${file.edition}, ${file.categories.length} categories, ${nominees} nominees`);
  for (const problem of validateCeremonyFile(file)) {
    console.warn(`Check: ${problem} (a new category goes to AWARDS.oscar and OSCAR_CANONICAL)`);
  }
  console.log(`Register it in src/lib/quinielas/ceremonies.ts if it is new.`);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const text = await load(args.path);
  const builtAt = new Date().toISOString().slice(0, 10);
  if (!args.ballotOnly) {
    await buildPeople(text, builtAt);
  }
  if (args.year) {
    await buildCeremony(text, { year: args.year, nominationsOn: args.nominationsOn, ceremonyOn: args.ceremonyOn }, builtAt);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
