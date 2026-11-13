/**
 * Quinielas de premios (FIL-I51-7): one ceremony as a ballot, pure and client-safe.
 *
 * Every ceremony is a file `src/data/quinielas/<award>-<year>.json` (format v2). The Oscars are
 * built from DLu/oscar_data (`npm run oscars:build -- --entrega <year>`); the other awards start
 * from `npm run quiniela:nueva` and their nominees are typed in by hand. In a nominee only `id`,
 * `work.title`, `work.kind` and, for people and songs, `person.name` / `song` are required: the TMDB
 * fields are filled by `npm run quiniela:tmdb` when there is a key, and at read time otherwise.
 */
import { addDays } from "@/lib/cine-core";
import { oscarYear } from "@/lib/oscars-core";
import {
  AWARDS,
  ceremonyIdOf,
  isAwardId,
  parseCeremonyId,
  type AwardId,
  type CategoryTemplate,
  type QuinielaCategoryKind,
} from "@/lib/quinielas/awards";

export type QuinielaWork = {
  /** As the awards list it (usually English). */
  title: string;
  kind: "movie" | "tv";
  imdbId: string | null;
  tmdbId?: number | null;
  /** Mexican title from TMDB (es-MX). */
  titleEs?: string | null;
  posterPath?: string | null;
};

export type QuinielaNominee = {
  /** Stable within its category: the work's IMDb id, the person's, or work + song. */
  id: string;
  work: QuinielaWork;
  /** Acting and directing: who is nominated. */
  person?: { name: string; imdbId: string | null; tmdbId?: number | null; profilePath?: string | null };
  /** Original song: the song's title. */
  song?: string;
  /** International / non-English-language film: the country, when the award names one. */
  country?: string;
};

export type QuinielaCategory = CategoryTemplate & { nominees: QuinielaNominee[] };

export type QuinielaCeremonyFile = {
  v: 2;
  /** `oscar-2027`. */
  id: string;
  award: AwardId;
  /** The year the ceremony is held. */
  year: number;
  /** 99 for the 99th Academy Awards; null when the award does not number them. */
  edition: number | null;
  /** `YYYY-MM-DD`: when the nominees are announced; the quiniela shows from that day. */
  nominationsOn: string;
  /** `YYYY-MM-DD`: the ceremony; the closing time itself is set in /admin/quinielas. */
  ceremonyOn: string;
  source: { repo: string; sha: string; builtAt: string } | { manual: true; builtAt: string; url?: string };
  categories: QuinielaCategory[];
};

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const firstOf = (value: string | undefined) => (value ?? "").split("|")[0]?.trim() ?? "";

// ── The Oscars from DLu/oscar_data ───────────────────────────────────────

/** DLu `CanonicalCategory` → the Oscar template's category id. */
export const OSCAR_CANONICAL: Readonly<Record<string, string>> = {
  "BEST PICTURE": "pelicula",
  DIRECTING: "direccion",
  "ACTRESS IN A LEADING ROLE": "actriz",
  "ACTOR IN A LEADING ROLE": "actor",
  "ACTRESS IN A SUPPORTING ROLE": "actriz-reparto",
  "ACTOR IN A SUPPORTING ROLE": "actor-reparto",
  "WRITING (Original Screenplay)": "guion-original",
  "WRITING (Adapted Screenplay)": "guion-adaptado",
  "ANIMATED FEATURE FILM": "animada",
  "INTERNATIONAL FEATURE FILM": "internacional",
  "DOCUMENTARY (Feature)": "documental",
  CINEMATOGRAPHY: "fotografia",
  "FILM EDITING": "montaje",
  CASTING: "casting",
  "ART DIRECTION": "diseno-produccion",
  "COSTUME DESIGN": "vestuario",
  "MAKEUP AND HAIRSTYLING": "maquillaje",
  "MUSIC (Original Score)": "banda-sonora",
  "MUSIC (Original Song)": "cancion",
  "SOUND MIXING": "sonido",
  "VISUAL EFFECTS": "efectos-visuales",
  "DOCUMENTARY (Short Subject)": "corto-documental",
  "SHORT FILM (Animated)": "corto-animado",
  "SHORT FILM (Live Action)": "cortometraje",
};

/** Classes whose categories are voted on; Special (honorary) and SciTech are given, not competed for. */
const BALLOT_CLASSES = new Set(["Acting", "Directing", "Writing", "Music", "Production", "Title"]);

/** Inverse of `oscarYear`: the ceremony number held in a year (96 in 2024). */
export const oscarCeremonyFor = (year: number) => year - 1928;

/**
 * One ceremony of `oscars.csv` (tab separated) → its ballot file, without TMDB fields. A category
 * the template does not know (a brand new one) keeps the Academy's name and goes last, so a new
 * year never silently loses a category; the validator flags it. Throws when the ceremony is not in
 * the file.
 */
export const buildOscarCeremony = (
  text: string,
  input: { year: number; nominationsOn: string; ceremonyOn: string; source: { repo: string; sha: string; builtAt: string } },
): QuinielaCeremonyFile => {
  const ceremony = oscarCeremonyFor(input.year);
  const lines = text.split(/\r?\n/);
  const header = (lines.shift() ?? "").split("\t");
  const col = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) {
      throw new Error(`oscars.csv: missing column ${name}`);
    }
    return index;
  };
  const c = {
    ceremony: col("Ceremony"),
    oscarClass: col("Class"),
    category: col("CanonicalCategory"),
    film: col("Film"),
    filmId: col("FilmId"),
    name: col("Name"),
    nomineeIds: col("NomineeIds"),
    detail: col("Detail"),
  };
  const templates = new Map(AWARDS.oscar.categories.map((template, index) => [template.id, { template, index }]));

  const byCategory = new Map<string, { category: QuinielaCategory; order: number }>();
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const cells = line.split("\t");
    if (Number(cells[c.ceremony]) !== ceremony) {
      continue;
    }
    const canonical = (cells[c.category] ?? "").trim();
    if (!BALLOT_CLASSES.has((cells[c.oscarClass] ?? "").trim()) || !canonical) {
      continue;
    }
    const known = templates.get(OSCAR_CANONICAL[canonical] ?? "");
    const template = known?.template ?? { id: slug(canonical), label: canonical, short: canonical, kind: "film" as const };
    const entry = byCategory.get(template.id) ?? {
      category: { ...template, nominees: [] },
      order: known?.index ?? Number.MAX_SAFE_INTEGER,
    };
    byCategory.set(template.id, entry);

    const filmTitle = firstOf(cells[c.film]);
    const filmIdRaw = firstOf(cells[c.filmId]);
    const filmImdbId = /^tt\d+$/.test(filmIdRaw) ? filmIdRaw : null;
    const name = (cells[c.name] ?? "").trim();
    const personIdRaw = firstOf(cells[c.nomineeIds]);
    const personImdbId = /^nm\d+$/.test(personIdRaw) ? personIdRaw : null;
    const nominee: QuinielaNominee = { id: "", work: { title: filmTitle || name, kind: "movie", imdbId: filmImdbId } };

    if (template.kind === "person") {
      nominee.person = { name, imdbId: personImdbId };
      nominee.id = personImdbId ?? slug(name);
    } else if (template.kind === "song") {
      nominee.song = firstOf(cells[c.detail]) || name;
      nominee.id = `${filmImdbId ?? slug(filmTitle)}:${slug(nominee.song)}`;
    } else {
      nominee.id = filmImdbId ?? slug(filmTitle || name);
      if (canonical === "INTERNATIONAL FEATURE FILM" && name) {
        nominee.country = name;
      }
    }
    const nominees = entry.category.nominees;
    if (nominees.some((other) => other.id === nominee.id)) {
      nominee.id = `${nominee.id}:${nominees.length + 1}`;
    }
    nominees.push(nominee);
  }

  if (byCategory.size === 0) {
    throw new Error(`oscars.csv: ceremony ${ceremony} (${input.year}) is not in the file`);
  }

  return {
    v: 2,
    id: ceremonyIdOf("oscar", oscarYear(ceremony)),
    award: "oscar",
    year: oscarYear(ceremony),
    edition: ceremony,
    nominationsOn: input.nominationsOn,
    ceremonyOn: input.ceremonyOn,
    source: input.source,
    categories: [...byCategory.values()].sort((a, b) => a.order - b.order).map((entry) => entry.category),
  };
};

// ── A file from the award's template (quiniela:nueva) ────────────────────

/** The skeleton `npm run quiniela:nueva` writes: every main category, no nominees yet. */
export const skeletonCeremony = (input: {
  award: AwardId;
  year: number;
  edition?: number | null;
  nominationsOn: string;
  ceremonyOn: string;
  builtAt: string;
  url?: string;
}): QuinielaCeremonyFile => ({
  v: 2,
  id: ceremonyIdOf(input.award, input.year),
  award: input.award,
  year: input.year,
  edition: input.edition ?? null,
  nominationsOn: input.nominationsOn,
  ceremonyOn: input.ceremonyOn,
  source: { manual: true, builtAt: input.builtAt, ...(input.url ? { url: input.url } : {}) },
  categories: AWARDS[input.award].categories.map((template) => ({ ...template, nominees: [] })),
});

// ── Validation ───────────────────────────────────────────────────────────

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KINDS: readonly QuinielaCategoryKind[] = ["film", "series", "person", "song"];

/**
 * Everything wrong with a ceremony file, in plain words; empty when it is good to play. `allowEmpty`
 * accepts a skeleton without nominees yet.
 */
export const validateCeremonyFile = (file: unknown, { allowEmpty = false } = {}): string[] => {
  const errors: string[] = [];
  const f = file as Partial<QuinielaCeremonyFile> | null;
  if (!f || typeof f !== "object") {
    return ["no es un objeto"];
  }
  if (f.v !== 2) errors.push("v debe ser 2");
  if (!isAwardId(f.award)) errors.push(`premio desconocido: ${String(f.award)}`);
  const parsed = parseCeremonyId(f.id);
  if (!parsed || parsed.award !== f.award || parsed.year !== f.year) {
    errors.push(`id ${String(f.id)} no corresponde a ${String(f.award)}-${String(f.year)}`);
  }
  if (!DAY.test(f.nominationsOn ?? "")) errors.push("nominationsOn debe ser YYYY-MM-DD");
  if (!DAY.test(f.ceremonyOn ?? "")) errors.push("ceremonyOn debe ser YYYY-MM-DD");
  if (DAY.test(f.nominationsOn ?? "") && DAY.test(f.ceremonyOn ?? "") && f.nominationsOn! >= f.ceremonyOn!) {
    errors.push("las nominaciones van antes de la ceremonia");
  }
  if (!Array.isArray(f.categories) || f.categories.length === 0) {
    errors.push("sin categorías");
    return errors;
  }
  const template = isAwardId(f.award) ? new Set(AWARDS[f.award].categories.map((category) => category.id)) : new Set();
  const categoryIds = new Set<string>();
  for (const category of f.categories) {
    const where = `categoría ${category?.id ?? "?"}`;
    if (!category?.id || !/^[a-z0-9-]+$/.test(category.id)) errors.push(`${where}: id inválido`);
    if (categoryIds.has(category.id)) errors.push(`${where}: repetida`);
    categoryIds.add(category.id);
    if (!template.has(category.id)) errors.push(`${where}: no está en la plantilla de ${String(f.award)}`);
    if (!category.label || !category.short) errors.push(`${where}: falta label o short`);
    if (!KINDS.includes(category.kind)) errors.push(`${where}: kind desconocido ${String(category.kind)}`);
    const nominees = Array.isArray(category.nominees) ? category.nominees : [];
    if (nominees.length < 2 && !(allowEmpty && nominees.length === 0)) {
      errors.push(`${where}: necesita al menos 2 nominadas`);
    }
    const nomineeIds = new Set<string>();
    for (const nominee of nominees) {
      const at = `${where} / ${nominee?.id ?? "?"}`;
      if (!nominee?.id) errors.push(`${at}: falta id`);
      if (nomineeIds.has(nominee.id)) errors.push(`${at}: repetida`);
      nomineeIds.add(nominee.id);
      if (!nominee.work?.title) errors.push(`${at}: falta work.title`);
      if (nominee.work?.kind !== "movie" && nominee.work?.kind !== "tv") errors.push(`${at}: work.kind debe ser movie o tv`);
      if (category.kind === "series" && nominee.work?.kind !== "tv") errors.push(`${at}: una serie debe ser tv`);
      if (category.kind === "person" && !nominee.person?.name) errors.push(`${at}: falta person.name`);
      if (category.kind === "song" && !nominee.song) errors.push(`${at}: falta song`);
    }
  }
  return errors;
};

// ── Reading a ceremony ───────────────────────────────────────────────────

export const findCategory = (file: QuinielaCeremonyFile, categoryId: string) =>
  file.categories.find((category) => category.id === categoryId) ?? null;

export const findNominee = (file: QuinielaCeremonyFile, categoryId: string, nomineeId: string) =>
  findCategory(file, categoryId)?.nominees.find((nominee) => nominee.id === nomineeId) ?? null;

/** TMDB falls back to the original title when it has no Spanish one (Hebrew, Japanese…). */
const isLatinScript = (value: string) => /[A-Za-zÀ-ÿ]/.test(value);

/** Mexican title when TMDB has one in Latin script, else the awards'. */
export const nomineeWorkTitle = (nominee: QuinielaNominee) => {
  const titleEs = nominee.work.titleEs?.trim();
  return titleEs && isLatinScript(titleEs) ? titleEs : nominee.work.title;
};

/** What a nominee is called on the ballot: the person, «the song», or the film or series. */
export const nomineeName = (nominee: QuinielaNominee) =>
  nominee.person?.name ?? (nominee.song ? `«${nominee.song}»` : nomineeWorkTitle(nominee));

/** The second line: the work for people and songs, the country for international films. */
export const nomineeDetail = (nominee: QuinielaNominee) =>
  nominee.person || nominee.song ? nomineeWorkTitle(nominee) : (nominee.country ?? null);

/**
 * When the quiniela of a ceremony is in season (`YYYY-MM-DD`, inclusive): from the nominations to
 * a week after the ceremony, so the results stay up a few days.
 */
export const ceremonyWindow = (file: Pick<QuinielaCeremonyFile, "nominationsOn" | "ceremonyOn">) => ({
  from: file.nominationsOn,
  to: addDays(file.ceremonyOn, 7),
});

// ── Ballot state and score ───────────────────────────────────────────────

export type QuinielaBallotPhase =
  /** No ceremony file or no closing time yet: «Abre con las nominaciones». */
  | "pronto"
  | "abierta"
  | "cerrada";

export const ballotPhase = (input: { hasCeremony: boolean; closesAt: Date | null; now: Date }): QuinielaBallotPhase => {
  if (!input.hasCeremony || !input.closesAt) {
    return "pronto";
  }
  return input.now.getTime() < input.closesAt.getTime() ? "abierta" : "cerrada";
};

export type CategoryResult = {
  categoryId: string;
  vote: string | null;
  winner: string | null;
  /** null until the category is announced. */
  hit: boolean | null;
};

export type BallotScore = {
  hits: number;
  /** Categories with a winner. */
  announced: number;
  total: number;
  remaining: number;
  /** Categories the person voted in. */
  voted: number;
  results: CategoryResult[];
};

/**
 * Hits of one ballot against the winners entered so far, in ballot order. Votes and winners for
 * categories the ceremony does not have are ignored.
 */
export const scoreBallot = (
  categoryIds: readonly string[],
  votes: Readonly<Record<string, string>>,
  winners: Readonly<Record<string, string>>,
): BallotScore => {
  const results = categoryIds.map((categoryId): CategoryResult => {
    const vote = Object.hasOwn(votes, categoryId) ? votes[categoryId]! : null;
    const winner = Object.hasOwn(winners, categoryId) ? winners[categoryId]! : null;
    return { categoryId, vote, winner, hit: winner === null ? null : vote === winner };
  });
  const announced = results.filter((result) => result.winner !== null).length;
  return {
    hits: results.filter((result) => result.hit === true).length,
    announced,
    total: categoryIds.length,
    remaining: categoryIds.length - announced,
    voted: results.filter((result) => result.vote !== null).length,
    results,
  };
};
