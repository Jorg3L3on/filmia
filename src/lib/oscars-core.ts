/**
 * Óscar per person (FIL-I43): parsing and lookup, pure and client-safe.
 *
 * Data: DLu/oscar_data `oscars.csv` (https://github.com/DLu/oscar_data, BSD-2-Clause), built from the
 * Academy Awards Database (https://awardsdatabase.oscars.org). `npm run oscars:build` turns it into
 * `src/data/oscars-by-person.json`, which only `@/lib/oscars` (server-only) imports.
 */

/** Pinned upstream commit; bump it and run `npm run oscars:build` after each ceremony. */
export const OSCAR_DATA_REPO = "DLu/oscar_data";
export const OSCAR_DATA_SHA = "c5e9716b7e020e70205d6b95f5a5678526c1b45f";

/**
 * Spanish label per CanonicalCategory (doc «Categorías Óscar en español» on FIL-I43). The key order
 * is also the order of several wins at one ceremony (Película before Dirección).
 */
export const OSCAR_CATEGORY_ES: Readonly<Record<string, string>> = {
  "BEST PICTURE": "Mejor película (producción)",
  "UNIQUE AND ARTISTIC PICTURE": "Película única y artística",
  DIRECTING: "Mejor dirección",
  "DIRECTING (Comedy Picture)": "Mejor dirección (comedia)",
  "DIRECTING (Dramatic Picture)": "Mejor dirección (drama)",
  "ASSISTANT DIRECTOR": "Mejor asistente de dirección",
  "DANCE DIRECTION": "Mejor dirección de baile",
  "ACTOR IN A LEADING ROLE": "Mejor actor",
  "ACTRESS IN A LEADING ROLE": "Mejor actriz",
  "ACTOR IN A SUPPORTING ROLE": "Mejor actor de reparto",
  "ACTRESS IN A SUPPORTING ROLE": "Mejor actriz de reparto",
  CASTING: "Mejor casting",
  "WRITING (Original Screenplay)": "Mejor guion original",
  "WRITING (Adapted Screenplay)": "Mejor guion adaptado",
  "WRITING (Original Story)": "Mejor argumento original",
  "WRITING (Title Writing)": "Mejores intertítulos",
  CINEMATOGRAPHY: "Mejor fotografía",
  "CINEMATOGRAPHY (Black-and-White)": "Mejor fotografía (blanco y negro)",
  "CINEMATOGRAPHY (Color)": "Mejor fotografía (color)",
  "FILM EDITING": "Mejor montaje",
  "ART DIRECTION": "Mejor diseño de producción",
  "ART DIRECTION (Black-and-White)": "Mejor dirección artística (blanco y negro)",
  "ART DIRECTION (Color)": "Mejor dirección artística (color)",
  "COSTUME DESIGN": "Mejor vestuario",
  "COSTUME DESIGN (Black-and-White)": "Mejor vestuario (blanco y negro)",
  "COSTUME DESIGN (Color)": "Mejor vestuario (color)",
  "MAKEUP AND HAIRSTYLING": "Mejor maquillaje y peluquería",
  "MUSIC (Original Score)": "Mejor banda sonora",
  "MUSIC (Original Song)": "Mejor canción original",
  "MUSIC (Original Song Score or Adaptation Score)": "Mejor música adaptada",
  "SOUND MIXING": "Mejor sonido",
  "SOUND EDITING": "Mejor edición de sonido",
  "SOUND RECORDING": "Mejor grabación de sonido",
  "VISUAL EFFECTS": "Mejores efectos visuales",
  "ANIMATED FEATURE FILM": "Mejor película animada",
  "INTERNATIONAL FEATURE FILM": "Mejor película internacional",
  "SPECIAL FOREIGN LANGUAGE FILM AWARD": "Premio especial a película extranjera",
  "DOCUMENTARY (Feature)": "Mejor documental",
  "DOCUMENTARY (Short Subject)": "Mejor cortometraje documental",
  "SHORT FILM (Animated)": "Mejor cortometraje animado",
  "SHORT FILM (Live Action)": "Mejor cortometraje",
  "SHORT SUBJECT (One-reel)": "Mejor cortometraje (un rollo)",
  "SHORT SUBJECT (Two-reel)": "Mejor cortometraje (dos rollos)",
  "SHORT SUBJECT (Comedy)": "Mejor cortometraje (comedia)",
  "SHORT SUBJECT (Novelty)": "Mejor cortometraje (novedad)",
  "SHORT SUBJECT (Color)": "Mejor cortometraje (color)",
  "HONORARY AWARD": "Óscar honorífico",
  "IRVING G. THALBERG MEMORIAL AWARD": "Premio Irving G. Thalberg",
  "JEAN HERSHOLT HUMANITARIAN AWARD": "Premio humanitario Jean Hersholt",
  "SPECIAL AWARD": "Premio especial",
  "SPECIAL ACHIEVEMENT AWARD": "Premio especial al logro",
  "SPECIAL ACHIEVEMENT AWARD (Visual Effects)": "Premio especial (efectos visuales)",
  "SPECIAL ACHIEVEMENT AWARD (Sound Effects)": "Premio especial (efectos de sonido)",
  "SPECIAL ACHIEVEMENT AWARD (Sound Effects Editing)": "Premio especial (edición de efectos de sonido)",
  "SPECIAL ACHIEVEMENT AWARD (Sound Editing)": "Premio especial (edición de sonido)",
};

const CATEGORY_ORDER = new Map(Object.keys(OSCAR_CATEGORY_ES).map((key, index) => [key, index]));

/** Competitive classes; SciTech is left out (technical plaques, not «un Óscar»). */
const INCLUDED_CLASSES = new Set(["Acting", "Directing", "Writing", "Music", "Production", "Title"]);

/** Special-class awards that count; commendations, Bonner and Sawyer do not. */
const INCLUDED_SPECIAL = new Set([
  "HONORARY AWARD",
  "IRVING G. THALBERG MEMORIAL AWARD",
  "JEAN HERSHOLT HUMANITARIAN AWARD",
  "SPECIAL AWARD",
  "SPECIAL FOREIGN LANGUAGE FILM AWARD",
]);

export const isIncludedOscarCategory = (oscarClass: string, category: string) =>
  INCLUDED_CLASSES.has(oscarClass) ||
  (oscarClass === "Special" &&
    (INCLUDED_SPECIAL.has(category) || category.startsWith("SPECIAL ACHIEVEMENT AWARD")));

/** Ceremony 1 was held in 1929, the 98th in 2026. */
export const oscarYear = (ceremony: number) => 1928 + ceremony;

/** Unknown categories (a new one at a future ceremony) keep the official English name. */
export const oscarCategoryEs = (category: string) => OSCAR_CATEGORY_ES[category] ?? category;

/** [ceremony, canonicalCategory, film title | null, film IMDb id | null] */
export type OscarWinTuple = [number, string, string | null, string | null];

export type OscarPersonEntry = {
  /** Nominations, wins included. */
  n: number;
  /** Wins; omitted when there are none. */
  w?: OscarWinTuple[];
  /** Nominations that did not win (FIL-I45-1); omitted when there are none. */
  x?: OscarWinTuple[];
};

export type OscarIndex = {
  source: { repo: string; sha: string; ceremonies: [number, number]; builtAt: string };
  people: Record<string, OscarPersonEntry>;
};

export type OscarWin = {
  ceremony: number;
  year: number;
  category: string;
  categoryEs: string;
  film: { title: string; imdbId: string | null } | null;
};

/**
 * Wins and the nominations that did not win (`nominated`), both newest first, plus the total count
 * of nominations (wins included).
 */
export type PersonOscarRecord = { wins: OscarWin[]; nominated: OscarWin[]; nominations: number };

const firstOf = (value: string | undefined) => (value ?? "").split("|")[0]?.trim() ?? "";

/**
 * Tab-separated `oscars.csv` → per-person index. A row with several films (Jannings, 1st ceremony)
 * is still one award: it keeps its first film.
 */
export const parseOscarsTsv = (
  text: string,
  source: Omit<OscarIndex["source"], "ceremonies">,
): OscarIndex => {
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
    nomineeIds: col("NomineeIds"),
    winner: col("Winner"),
  };

  const people: Record<string, OscarPersonEntry> = {};
  let min = Infinity;
  let max = -Infinity;
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const cells = line.split("\t");
    const ceremony = Number(cells[c.ceremony]);
    if (!Number.isInteger(ceremony) || ceremony <= 0) {
      continue;
    }
    min = Math.min(min, ceremony);
    max = Math.max(max, ceremony);
    const category = (cells[c.category] ?? "").trim();
    if (!isIncludedOscarCategory((cells[c.oscarClass] ?? "").trim(), category)) {
      continue;
    }
    const ids = new Set(
      (cells[c.nomineeIds] ?? "")
        .split("|")
        .map((id) => id.trim())
        .filter((id) => /^nm\d+$/.test(id)),
    );
    if (ids.size === 0) {
      continue;
    }
    const won = (cells[c.winner] ?? "").trim() === "True";
    const filmTitle = firstOf(cells[c.film]) || null;
    const filmId = firstOf(cells[c.filmId]);
    const win: OscarWinTuple = [ceremony, category, filmTitle, /^tt\d+$/.test(filmId) ? filmId : null];
    for (const id of ids) {
      const entry = (people[id] ??= { n: 0 });
      entry.n += 1;
      if (won) {
        (entry.w ??= []).push(win);
      } else {
        (entry.x ??= []).push(win);
      }
    }
  }

  return {
    source: { ...source, ceremonies: [Number.isFinite(min) ? min : 0, Number.isFinite(max) ? max : 0] },
    people,
  };
};

const toOscarWin = ([ceremony, category, title, filmImdbId]: OscarWinTuple): OscarWin => ({
  ceremony,
  year: oscarYear(ceremony),
  category,
  categoryEs: oscarCategoryEs(category),
  film: title ? { title, imdbId: filmImdbId } : null,
});

const byNewest = (a: OscarWin, b: OscarWin) =>
  b.ceremony - a.ceremony ||
  (CATEGORY_ORDER.get(a.category) ?? Number.MAX_SAFE_INTEGER) -
    (CATEGORY_ORDER.get(b.category) ?? Number.MAX_SAFE_INTEGER);

/** Wins and lost nominations newest first (then category order), and the count; null for an unknown id. */
export const oscarsFor = (index: OscarIndex, imdbId: string | null | undefined): PersonOscarRecord | null => {
  const id = imdbId?.trim();
  if (!id || !Object.hasOwn(index.people, id)) {
    return null;
  }
  const entry = index.people[id];
  if (!entry || entry.n <= 0) {
    return null;
  }
  const wins = (entry.w ?? []).map(toOscarWin).sort(byNewest);
  const nominated = (entry.x ?? []).map(toOscarWin).sort(byNewest);
  return { wins, nominated, nominations: Math.max(entry.n, wins.length + nominated.length) };
};
