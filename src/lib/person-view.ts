import type { FilmographyEntry } from "@/lib/person-filmography";
import { FILMOGRAPHY_FACTS_LIMIT, type SearchResultFacts } from "@/lib/search-result-facts";
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

/**
 * The shelves are drawn once, when every title the view asks about has its
 * final answer (FIL-I30-4): the Catalog's first reply, or the one after the
 * enrichment retry. Drawn earlier, a late IMDb rating or affinity swapped
 * posters (and the shelf's name) a few seconds in. Only the best-known
 * `limit` titles are asked about (the client's order), so only they count.
 */
export const shelvesSettled = (
  entries: readonly FilmographyEntry[],
  factsOf: FactsOf,
  limit = FILMOGRAPHY_FACTS_LIMIT,
) =>
  [...entries]
    .sort((a, b) => b.votes - a.votes)
    .slice(0, limit)
    .every((entry) => {
      const facts = factsOf(entry);
      return facts !== null && !facts.pending;
    });

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

/**
 * «En mis plataformas» (FIL-I30-2): the titles included on one of yours, how
 * many are still being checked against TMDB, and how many stay unknown.
 */
export const mineSplit = (entries: readonly FilmographyEntry[], factsOf: FactsOf) => {
  const shown: FilmographyEntry[] = [];
  let checking = 0;
  let unknown = 0;
  for (const entry of entries) {
    const facts = factsOf(entry);
    if (facts?.onMine) {
      shown.push(entry);
    } else if (facts?.onMine === false) {
      continue;
    } else if (!facts || facts.pending || facts.providersPending) {
      checking += 1;
    } else {
      unknown += 1;
    }
  }
  return { shown, checking, unknown };
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

/* ── FIL-I45 «Tu recorrido» ─────────────────────────────────────────────────────────────────── */

type WatchedFacts = Pick<SearchResultFacts, "watched">;

/**
 * The headline next to the ring, by how much of the work you have seen. Gender-neutral («su obra»):
 * the person's gender is not in the data the view loads.
 */
export const recorridoTitle = (watched: number, total: number) => {
  if (total <= 0 || watched <= 0) {
    return "Aún no has visto nada suyo";
  }
  if (watched >= total) {
    return "Viste toda su obra";
  }
  const share = watched / total;
  if (share < 0.2) return "Apenas empiezas con su obra";
  if (share < 0.4) return "Le vas tomando el hilo";
  if (share < 0.6) return "Vas por la mitad";
  if (share < 0.8) return "Llevas la mayor parte";
  return "Casi completo";
};

/** «mar 2025» for the film strip; null without a date. */
export const monthYearLabel = (date: string | null | undefined) => {
  if (!date) {
    return null;
  }
  const [year, month] = date.split("-").map(Number);
  return month ? `${MONTHS[month - 1]} ${year}` : String(year);
};

export type StripFrame = {
  entry: FilmographyEntry;
  state: "watched" | "watchlist" | "unseen";
  /** Your stars, for a watched title (null = watched, not rated). */
  rating: number | null;
  /** `YYYY-MM-DD` you watched it, when known. */
  on: string | null;
};

/** Frames drawn before «+N · Ver todas». */
export const STRIP_FRAMES_MAX = 5;

/**
 * The film strip of «Tu recorrido»: what you watched first (latest first, undated last), then what
 * waits in Quiero ver, then the rest by how known it is; `more` counts what does not fit.
 */
export const watchedStrip = (
  entries: readonly FilmographyEntry[],
  statusOf: (entry: FilmographyEntry) => LibraryStatus,
  factsOf: (entry: FilmographyEntry) => WatchedFacts | null,
  max = STRIP_FRAMES_MAX,
) => {
  const frames: StripFrame[] = entries.map((entry) => {
    const status = statusOf(entry);
    const watched = factsOf(entry)?.watched ?? null;
    if (status === "watched" || watched) {
      return { entry, state: "watched", rating: watched?.rating ?? null, on: watched?.on ?? null };
    }
    return { entry, state: status === "watchlist" ? "watchlist" : "unseen", rating: null, on: null };
  });
  const rank = { watched: 0, watchlist: 1, unseen: 2 } as const;
  frames.sort(
    (a, b) =>
      rank[a.state] - rank[b.state] ||
      (a.state === "watched" ? (b.on ?? "").localeCompare(a.on ?? "") : 0) ||
      b.entry.votes - a.entry.votes,
  );
  const watched = frames.filter((frame) => frame.state === "watched");
  return {
    frames: frames.slice(0, Math.max(0, max)),
    more: Math.max(0, frames.length - max),
    /** Every watched title, latest first: the «Ver todas» sheet. */
    watched,
    /** The latest watched title with a date, for «La última: X, fecha». */
    last: watched.find((frame) => frame.on) ?? null,
  };
};

/** «Siguiente para ti»: the first unwatched of «Muy tu estilo» / «Podría gustarte», else of «Lo esencial». */
export const nextForYou = (
  taste: ReturnType<typeof tastePicks>,
  essential: readonly FilmographyEntry[],
  statusOf: (entry: FilmographyEntry) => LibraryStatus,
) => {
  const fromTaste = taste?.entries.find((entry) => statusOf(entry) !== "watched");
  if (fromTaste) {
    return { entry: fromTaste, source: "taste" as const };
  }
  const fromEssential = essential.find((entry) => statusOf(entry) !== "watched");
  return fromEssential ? { entry: fromEssential, source: "essential" as const } : null;
};

type OscarCounts = { wins: readonly unknown[]; nominations: number } | null | undefined;

/**
 * The hero's third number: the person's own Óscar (won, else nominations), else nothing. The awards
 * of their films are not theirs («13 Óscar de su obra» on Keanu Reeves read as his own).
 */
export const thirdStat = (
  oscars: OscarCounts,
): { value: number; label: string; tone: "gold" | "plain" } | null => {
  if (oscars && oscars.wins.length > 0) {
    return { value: oscars.wins.length, label: "Óscar", tone: "gold" };
  }
  if (oscars && oscars.nominations > 0) {
    return { value: oscars.nominations, label: "nom. al Óscar", tone: "gold" };
  }
  return null;
};

/** «n. 1937 · South Shields · † 2020»: only what TMDB has; null when it has nothing. */
export const personLifeLine = (person: {
  birthday?: string | null;
  deathday?: string | null;
  placeOfBirth?: string | null;
}) => {
  const born = person.birthday?.slice(0, 4);
  const place = person.placeOfBirth?.split(",")[0]?.trim();
  const died = person.deathday?.slice(0, 4);
  const parts = [born ? `n. ${born}` : null, place || null, died ? `† ${died}` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
};
