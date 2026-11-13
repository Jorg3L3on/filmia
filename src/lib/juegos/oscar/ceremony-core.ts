/**
 * Quiniela del Óscar (FIL-I51): one ceremony as a ballot, pure and client-safe.
 *
 * `npm run oscars:build` turns a ceremony of DLu/oscar_data (`oscars.csv`, see `@/lib/oscars-core`)
 * into `src/data/oscar-ceremonies/<year>.json`. When the free dataset does not have a new ceremony
 * yet, the same file can be written by hand: only `id`, `film.title` and, for people and songs,
 * `person.name` / `song` are required; the TMDB fields are filled at build time when there is a key,
 * and at read time otherwise.
 */
import { oscarYear } from "@/lib/oscars-core";

export type OscarCategoryKind = "film" | "person" | "song";

export type OscarNominee = {
  /** Stable within its category: the film's IMDb id, the person's, or film + song. */
  id: string;
  film: {
    /** Title as the Academy lists it (English). */
    title: string;
    imdbId: string | null;
    tmdbId?: number | null;
    /** Mexican title from TMDB (es-MX). */
    titleEs?: string | null;
    posterPath?: string | null;
  };
  /** Acting and directing: who is nominated. */
  person?: { name: string; imdbId: string | null; tmdbId?: number | null; profilePath?: string | null };
  /** Original song: the song's title. */
  song?: string;
  /** International feature: the country that submitted it. */
  country?: string;
};

export type OscarBallotCategory = {
  /** Slug, e.g. `pelicula`, `actriz-reparto`. */
  id: string;
  /** DLu CanonicalCategory, e.g. `ACTRESS IN A SUPPORTING ROLE`. */
  canonical: string;
  /** «Mejor actriz de reparto». */
  label: string;
  /** «Actriz de reparto», for lists and the share image. */
  short: string;
  kind: OscarCategoryKind;
  nominees: OscarNominee[];
};

export type OscarCeremonyFile = {
  v: 1;
  ceremony: number;
  /** The year the ceremony is held (2024 for the 96th). */
  year: number;
  source: { repo: string; sha: string; builtAt: string } | { manual: true; builtAt: string };
  categories: OscarBallotCategory[];
};

type BallotCategoryDef = { id: string; label: string; short: string; kind: OscarCategoryKind };

/**
 * The competitive categories of the ballot, in the order the ballot asks them. A category that
 * appears in a ceremony but not here (a brand new one) goes last with its English name, so a new
 * year never silently loses a category; `npm test` flags it.
 */
export const OSCAR_BALLOT_CATEGORIES: Readonly<Record<string, BallotCategoryDef>> = {
  "BEST PICTURE": { id: "pelicula", label: "Mejor película", short: "Película", kind: "film" },
  DIRECTING: { id: "direccion", label: "Mejor dirección", short: "Dirección", kind: "person" },
  "ACTRESS IN A LEADING ROLE": { id: "actriz", label: "Mejor actriz", short: "Actriz", kind: "person" },
  "ACTOR IN A LEADING ROLE": { id: "actor", label: "Mejor actor", short: "Actor", kind: "person" },
  "ACTRESS IN A SUPPORTING ROLE": {
    id: "actriz-reparto",
    label: "Mejor actriz de reparto",
    short: "Actriz de reparto",
    kind: "person",
  },
  "ACTOR IN A SUPPORTING ROLE": {
    id: "actor-reparto",
    label: "Mejor actor de reparto",
    short: "Actor de reparto",
    kind: "person",
  },
  "WRITING (Original Screenplay)": {
    id: "guion-original",
    label: "Mejor guion original",
    short: "Guion original",
    kind: "film",
  },
  "WRITING (Adapted Screenplay)": {
    id: "guion-adaptado",
    label: "Mejor guion adaptado",
    short: "Guion adaptado",
    kind: "film",
  },
  "ANIMATED FEATURE FILM": { id: "animada", label: "Mejor película animada", short: "Animada", kind: "film" },
  "INTERNATIONAL FEATURE FILM": {
    id: "internacional",
    label: "Mejor película internacional",
    short: "Internacional",
    kind: "film",
  },
  "DOCUMENTARY (Feature)": { id: "documental", label: "Mejor documental", short: "Documental", kind: "film" },
  CINEMATOGRAPHY: { id: "fotografia", label: "Mejor fotografía", short: "Fotografía", kind: "film" },
  "FILM EDITING": { id: "montaje", label: "Mejor montaje", short: "Montaje", kind: "film" },
  CASTING: { id: "casting", label: "Mejor casting", short: "Casting", kind: "film" },
  "ART DIRECTION": {
    id: "diseno-produccion",
    label: "Mejor diseño de producción",
    short: "Diseño de producción",
    kind: "film",
  },
  "COSTUME DESIGN": { id: "vestuario", label: "Mejor vestuario", short: "Vestuario", kind: "film" },
  "MAKEUP AND HAIRSTYLING": {
    id: "maquillaje",
    label: "Mejor maquillaje y peluquería",
    short: "Maquillaje",
    kind: "film",
  },
  "MUSIC (Original Score)": { id: "banda-sonora", label: "Mejor banda sonora", short: "Banda sonora", kind: "film" },
  "MUSIC (Original Song)": { id: "cancion", label: "Mejor canción original", short: "Canción", kind: "song" },
  "SOUND MIXING": { id: "sonido", label: "Mejor sonido", short: "Sonido", kind: "film" },
  "VISUAL EFFECTS": { id: "efectos-visuales", label: "Mejores efectos visuales", short: "Efectos visuales", kind: "film" },
  "DOCUMENTARY (Short Subject)": {
    id: "corto-documental",
    label: "Mejor cortometraje documental",
    short: "Corto documental",
    kind: "film",
  },
  "SHORT FILM (Animated)": {
    id: "corto-animado",
    label: "Mejor cortometraje animado",
    short: "Corto animado",
    kind: "film",
  },
  "SHORT FILM (Live Action)": { id: "cortometraje", label: "Mejor cortometraje", short: "Cortometraje", kind: "film" },
};

const BALLOT_ORDER = new Map(Object.keys(OSCAR_BALLOT_CATEGORIES).map((key, index) => [key, index]));

/** Classes whose categories are voted on; Special (honorary) and SciTech are given, not competed for. */
const BALLOT_CLASSES = new Set(["Acting", "Directing", "Writing", "Music", "Production", "Title"]);

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const firstOf = (value: string | undefined) => (value ?? "").split("|")[0]?.trim() ?? "";

/** Inverse of `oscarYear`: the ceremony number held in a year (96 in 2024). */
export const oscarCeremonyFor = (year: number) => year - 1928;

/**
 * One ceremony of `oscars.csv` (tab separated) → the ballot file, without TMDB fields. Throws when
 * the ceremony is not in the file.
 */
export const buildOscarCeremony = (
  text: string,
  year: number,
  source: { repo: string; sha: string; builtAt: string },
): OscarCeremonyFile => {
  const ceremony = oscarCeremonyFor(year);
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

  const byCategory = new Map<string, OscarBallotCategory>();
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
    const def = OSCAR_BALLOT_CATEGORIES[canonical] ?? {
      id: slug(canonical),
      label: canonical,
      short: canonical,
      kind: "film" as const,
    };
    const category = byCategory.get(canonical) ?? { ...def, canonical, nominees: [] };
    byCategory.set(canonical, category);

    const filmTitle = firstOf(cells[c.film]);
    const filmIdRaw = firstOf(cells[c.filmId]);
    const filmImdbId = /^tt\d+$/.test(filmIdRaw) ? filmIdRaw : null;
    const name = (cells[c.name] ?? "").trim();
    const personIdRaw = firstOf(cells[c.nomineeIds]);
    const personImdbId = /^nm\d+$/.test(personIdRaw) ? personIdRaw : null;
    const nominee: OscarNominee = { id: "", film: { title: filmTitle || name, imdbId: filmImdbId } };

    if (def.kind === "person") {
      nominee.person = { name, imdbId: personImdbId };
      nominee.id = personImdbId ?? slug(name);
    } else if (def.kind === "song") {
      nominee.song = firstOf(cells[c.detail]) || name;
      nominee.id = `${filmImdbId ?? slug(filmTitle)}:${slug(nominee.song)}`;
    } else {
      nominee.id = filmImdbId ?? slug(filmTitle || name);
      if (canonical === "INTERNATIONAL FEATURE FILM" && name) {
        nominee.country = name;
      }
    }
    if (category.nominees.some((other) => other.id === nominee.id)) {
      nominee.id = `${nominee.id}:${category.nominees.length + 1}`;
    }
    category.nominees.push(nominee);
  }

  if (byCategory.size === 0) {
    throw new Error(`oscars.csv: ceremony ${ceremony} (${year}) is not in the file`);
  }

  const categories = [...byCategory.values()].sort(
    (a, b) =>
      (BALLOT_ORDER.get(a.canonical) ?? Number.MAX_SAFE_INTEGER) -
      (BALLOT_ORDER.get(b.canonical) ?? Number.MAX_SAFE_INTEGER),
  );
  return { v: 1, ceremony, year: oscarYear(ceremony), source, categories };
};

/** Categories of a ceremony that the ballot does not know yet (a new category). */
export const unknownBallotCategories = (file: OscarCeremonyFile) =>
  file.categories.filter((category) => !Object.hasOwn(OSCAR_BALLOT_CATEGORIES, category.canonical));

export const findCategory = (file: OscarCeremonyFile, categoryId: string) =>
  file.categories.find((category) => category.id === categoryId) ?? null;

export const findNominee = (file: OscarCeremonyFile, categoryId: string, nomineeId: string) =>
  findCategory(file, categoryId)?.nominees.find((nominee) => nominee.id === nomineeId) ?? null;

/** Mexican title when TMDB has one, else the Academy's. */
export const nomineeFilmTitle = (nominee: OscarNominee) => nominee.film.titleEs?.trim() || nominee.film.title;

/** What a nominee is called on the ballot: the person, «the song», or the film. */
export const nomineeName = (nominee: OscarNominee) =>
  nominee.person?.name ?? (nominee.song ? `«${nominee.song}»` : nomineeFilmTitle(nominee));

/** The second line: the film for people and songs, the country for international films. */
export const nomineeDetail = (nominee: OscarNominee) =>
  nominee.person || nominee.song ? nomineeFilmTitle(nominee) : (nominee.country ?? null);

// ── Ballot state and score ───────────────────────────────────────────────

export type OscarBallotPhase =
  /** No ceremony file or no closing time yet: «Abre con las nominaciones». */
  | "pronto"
  | "abierta"
  | "cerrada";

export const oscarBallotPhase = (input: { hasCeremony: boolean; closesAt: Date | null; now: Date }): OscarBallotPhase => {
  if (!input.hasCeremony || !input.closesAt) {
    return "pronto";
  }
  return input.now.getTime() < input.closesAt.getTime() ? "abierta" : "cerrada";
};

export type OscarCategoryResult = {
  categoryId: string;
  vote: string | null;
  winner: string | null;
  /** null until the category is announced. */
  hit: boolean | null;
};

export type OscarScore = {
  hits: number;
  /** Categories with a winner. */
  announced: number;
  total: number;
  remaining: number;
  /** Categories the person voted in. */
  voted: number;
  results: OscarCategoryResult[];
};

/**
 * Hits of one ballot against the winners entered so far, in ballot order. Votes and winners for
 * categories the ceremony does not have are ignored.
 */
export const scoreOscarBallot = (
  categoryIds: readonly string[],
  votes: Readonly<Record<string, string>>,
  winners: Readonly<Record<string, string>>,
): OscarScore => {
  const results = categoryIds.map((categoryId): OscarCategoryResult => {
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
