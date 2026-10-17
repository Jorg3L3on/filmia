import { addDays, formatShortDay, ticketStub } from "@/lib/cine-core";
import type { PushPayload } from "@/lib/push/web-push";

/**
 * «Llega a cines» (FIL-I17-6): a Quiero ver film that premieres in MX theaters within the week.
 * The cron runs daily, so the first run inside the window sends it; the `CinemaAlert` ledger
 * (keyed by the release date) stops repeats, and a moved date counts again.
 */
export const CINEMA_ALERT_WINDOW_DAYS = 7;

/** Past this many premieres in one run a user gets one summary instead of a pile of pushes. */
export const MAX_CINEMA_PUSHES_PER_USER = 3;

export type CinemaAlertCandidate = {
  userId: string;
  titleId: string;
  catalogId: string;
  name: string;
  mxReleaseDate: string;
  status: string;
  /** Already marked seen: no point announcing it. */
  watched: boolean;
  /** A `CinemaAlert` row exists for this user, film and date. */
  alerted: boolean;
};

export type CinemaArrival = {
  userId: string;
  titleId: string;
  catalogId: string;
  name: string;
  mxReleaseDate: string;
};

/** Unseen, not yet announced for this date, premiering today or in the next 7 days. */
export const selectCinemaArrivals = (
  candidates: readonly CinemaAlertCandidate[],
  today: string,
  windowDays = CINEMA_ALERT_WINDOW_DAYS,
): CinemaArrival[] => {
  const until = addDays(today, windowDays);
  const seen = new Set<string>();
  const arrivals: CinemaArrival[] = [];
  for (const candidate of candidates) {
    if (candidate.watched || candidate.alerted || candidate.status === "gone") continue;
    if (candidate.mxReleaseDate < today || candidate.mxReleaseDate > until) continue;
    const key = `${candidate.userId}:${candidate.catalogId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    arrivals.push({
      userId: candidate.userId,
      titleId: candidate.titleId,
      catalogId: candidate.catalogId,
      name: candidate.name,
      mxReleaseDate: candidate.mxReleaseDate,
    });
  }
  return arrivals.sort((a, b) => a.mxReleaseDate.localeCompare(b.mxReleaseDate));
};

/** «hoy» or «el jue 22 oct». */
export const premiereDayLabel = (mxReleaseDate: string, today: string) => {
  if (mxReleaseDate === today) {
    return "hoy";
  }
  const weekday = ticketStub(mxReleaseDate).weekday.toLowerCase();
  return `el ${weekday} ${formatShortDay(mxReleaseDate)}`;
};

export const cinemaArrivalPayload = (arrival: CinemaArrival, today: string): PushPayload => ({
  title: "Llega a cines",
  body: `«${arrival.name}», de tu Quiero ver, se estrena ${premiereDayLabel(arrival.mxReleaseDate, today)}.`,
  url: `/titulos/${arrival.titleId}`,
  tag: `cine-${arrival.catalogId}`,
});

/** One user's pushes for a run: one per film, or a single summary past the cap. */
export const cinemaPayloadsForUser = (arrivals: readonly CinemaArrival[], today: string): PushPayload[] => {
  if (arrivals.length <= MAX_CINEMA_PUSHES_PER_USER) {
    return arrivals.map((arrival) => cinemaArrivalPayload(arrival, today));
  }
  const names = arrivals.slice(0, 2).map((arrival) => `«${arrival.name}»`);
  return [
    {
      title: `${arrivals.length} de Quiero ver llegan a cines esta semana`,
      body: `${names.join(", ")} y ${arrivals.length - names.length} más.`,
      url: "/cine/proximamente",
      tag: "cine-resumen",
    },
  ];
};
