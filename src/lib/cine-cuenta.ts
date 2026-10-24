import type { ThreadPerson, ThreadPersonRole } from "@/lib/rutas/core";
import type { PushPayload } from "@/lib/push/web-push";

/**
 * Cuenta regresiva (FIL-I26-5, board P3): Cine's «Para ti, en sala» lists premieres with someone
 * of your universe behind them, the nearest first, with the days left. Never one without a
 * person: that is what makes it yours. Pure; the store reads CinemaRelease and the universe.
 */

export const COUNTDOWN_LIMIT = 4;

export type CountdownRelease = {
  catalogId: string;
  tmdbId: number;
  name: string;
  posterPath: string | null;
  mxReleaseDate: string;
  people: readonly ThreadPerson[];
};

/** A person of your universe: their main role and the first film of yours with them. */
export type UniversePerson = { id: number; name: string; role: ThreadPersonRole; films: string[] };

export type Countdown = {
  release: CountdownRelease;
  person: UniversePerson;
  /** Their role in the premiere (can differ from their role in your films). */
  role: ThreadPersonRole;
  days: number;
  reason: string;
};

const ROLE_RANK: Record<ThreadPersonRole, number> = { director: 0, dp: 1, composer: 2, cast: 3 };

const DAY_MS = 86_400_000;

export const daysUntil = (day: string, today: string) =>
  Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);

const VERB: Record<ThreadPersonRole, string> = {
  director: "dirigió",
  dp: "fotografió",
  composer: "hizo la música de",
  cast: "sale en",
};

/** «Greig Fraser, que fotografió Proyecto Fin del Mundo»: who, and the film of yours that brought them. */
export const countdownReason = (person: UniversePerson) =>
  `${person.name}, que ${VERB[person.role]} ${person.films[0] ?? "una película tuya"}`;

/** «Faltan 56 días», «Mañana», «Hoy». */
export const daysLabel = (days: number) =>
  days <= 0 ? "Hoy" : days === 1 ? "Mañana" : `Faltan ${days} días`;

/**
 * Premieres from today on with a person of your universe in them (crew before cast, the person
 * with more of your films first), the nearest first.
 */
export const countdownsFor = (
  releases: readonly CountdownRelease[],
  universe: ReadonlyMap<number, UniversePerson>,
  today: string,
  limit = COUNTDOWN_LIMIT,
): Countdown[] => {
  const out: Countdown[] = [];
  for (const release of releases) {
    if (release.mxReleaseDate < today) {
      continue;
    }
    const matches = release.people
      .flatMap((person) => {
        const yours = universe.get(person.id);
        return yours ? [{ person: yours, role: person.role }] : [];
      })
      .sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || b.person.films.length - a.person.films.length);
    const best = matches[0];
    if (!best) {
      continue;
    }
    out.push({
      release,
      person: best.person,
      role: best.role,
      days: daysUntil(release.mxReleaseDate, today),
      reason: countdownReason(best.person),
    });
  }
  return out
    .sort((a, b) => a.release.mxReleaseDate.localeCompare(b.release.mxReleaseDate) || a.release.name.localeCompare(b.release.name, "es"))
    .slice(0, limit);
};

/** The day-of push for «Avísame el día». */
export const premierePayload = (release: { catalogId: string; name: string }, reason: string | null): PushPayload => ({
  title: "Hoy se estrena",
  body: reason ? `«${release.name}». ${reason}.` : `«${release.name}» ya está en cines.`,
  url: "/cine",
  tag: `estreno-${release.catalogId}`,
});
