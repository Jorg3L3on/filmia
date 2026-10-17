import type { FilmographyEntry } from "@/lib/person-filmography";
import type { SearchResultFacts } from "@/lib/search-result-facts";
import type { AffinityLevel } from "@/lib/tonight/affinity";

/**
 * Buscar's person view, direction B «Lo esencial» (FIL-I16-4): the shelves,
 * the «Has visto» counter and the decades, as pure functions of the work and
 * row A's facts, so the choices are unit-tested without the page.
 */

type FactsOf = (entry: FilmographyEntry) => SearchResultFacts | null;
type LibraryStatus = "watched" | "watchlist" | null;

/** «Lo esencial»: at most this many, and only once this many have an IMDb rating. */
export const ESSENTIAL_MAX = 6;
export const ESSENTIAL_MIN = 3;
/** «Podría gustarte» / «Muy tu estilo»: at most this many, shown from this many. */
export const TASTE_MAX = 6;
export const TASTE_MIN = 2;

/** Best IMDb first (ties: the better-known title); watched ones stay in, marked by the card. */
export const essentialPicks = (entries: readonly FilmographyEntry[], factsOf: FactsOf) => {
  const rated = entries.flatMap((entry) => {
    const rating = factsOf(entry)?.imdbRating;
    return rating == null ? [] : [{ entry, rating }];
  });
  if (rated.length < ESSENTIAL_MIN) {
    return [];
  }
  return rated
    .sort((a, b) => b.rating - a.rating || b.entry.votes - a.entry.votes)
    .slice(0, ESSENTIAL_MAX)
    .map(({ entry }) => entry);
};

/** The shelf is named after its best level (the affinity labels, without loading the scorer). */
export const TASTE_SHELF_TITLE: Record<Exclude<AffinityLevel, "baja">, string> = {
  alta: "Muy tu estilo",
  media: "Podría gustarte",
};

/**
 * The closest to your taste you have not watched: «Muy tu estilo» first, then
 * «Podría gustarte», each by IMDb. Null without a taste profile (no affinity).
 */
export const tastePicks = (
  entries: readonly FilmographyEntry[],
  factsOf: FactsOf,
): { level: Exclude<AffinityLevel, "baja">; entries: FilmographyEntry[] } | null => {
  const near = entries.flatMap((entry) => {
    const facts = factsOf(entry);
    const level = facts?.affinity?.level;
    if (!facts || facts.watched || !level || level === "baja") {
      return [];
    }
    return [{ entry, level, rating: facts.imdbRating ?? 0 }];
  });
  if (near.length < TASTE_MIN) {
    return null;
  }
  near.sort(
    (a, b) =>
      (a.level === b.level ? 0 : a.level === "alta" ? -1 : 1) ||
      b.rating - a.rating ||
      b.entry.votes - a.entry.votes,
  );
  return {
    level: near[0]!.level,
    entries: near.slice(0, TASTE_MAX).map(({ entry }) => entry),
  };
};

/** «Has visto X de N · Y en Quiero ver», plus one mark per title for the bar. */
export const watchProgress = (
  entries: readonly FilmographyEntry[],
  statusOf: (entry: FilmographyEntry) => LibraryStatus,
) => {
  const marks = entries.map(statusOf);
  return {
    total: entries.length,
    watched: marks.filter((mark) => mark === "watched").length,
    watchlist: marks.filter((mark) => mark === "watchlist").length,
    marks,
  };
};

/** The bar draws one mark per title up to this many; past it, proportional segments. */
export const PROGRESS_MARKS_MAX = 40;

/** The work by decade, newest first (the entries come newest first). */
export const groupByDecade = (entries: readonly FilmographyEntry[]) => {
  const groups: { decade: number; label: string; entries: FilmographyEntry[] }[] = [];
  for (const entry of entries) {
    if (!entry.year) {
      continue;
    }
    const decade = Math.floor(entry.year / 10) * 10;
    const last = groups.at(-1);
    if (last?.decade === decade) {
      last.entries.push(entry);
    } else {
      groups.push({ decade, label: `${decade}s`, entries: [entry] });
    }
  }
  return groups;
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «25 nov», or «25 mar 2027» when it is not this year. */
export const releaseDateLabel = (date: string, today: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const label = `${day} ${MONTHS[(month ?? 1) - 1]}`;
  return String(year) === today.slice(0, 4) ? label : `${label} ${year}`;
};

/** The «Próximamente» card: the next release and how many more are announced. */
export const upcomingSummary = (upcoming: readonly FilmographyEntry[], today: string) => {
  const next = upcoming[0];
  if (!next) {
    return null;
  }
  const rest = upcoming.slice(1);
  const undated = rest.filter((entry) => !entry.date).length;
  const more =
    rest.length === 0
      ? null
      : undated === rest.length
        ? `y ${undated} sin fecha`
        : `y ${rest.length} más`;
  return {
    entry: next,
    when: next.date ? releaseDateLabel(next.date, today) : "Sin fecha",
    more,
  };
};
