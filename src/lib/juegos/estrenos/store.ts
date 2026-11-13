import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { catalog, cinemaReleases, db, juegoEstrenos, juegoPronosticos, users } from "@/db";
import { addDays, mxToday } from "@/lib/cine-core";
import {
  closestOf,
  estrenoChip,
  estrenoPhase,
  isForecastOpen,
  mayRevealOthers,
  monthBounds,
  monthOf,
  pickEstrenos,
  ratingToTenths,
  resolveOnOf,
  type EstrenoPhase,
} from "@/lib/juegos/estrenos/core";
import { initialOf, retoNames } from "@/lib/juegos/retos/core";

/**
 * Quiniela de estrenos on the database (FIL-I55-1): the month's picks, saving a forecast, the view
 * a person gets (others hidden until theirs is saved) and the cron's resolution. Never writes `Title`.
 */

/** How long a resolved release stays on the page. */
const RESOLVED_VISIBLE_DAYS = 30;

export class EstrenoClosedError extends Error {
  constructor() {
    super("Ya se estrenó: el pronóstico quedó cerrado.");
    this.name = "EstrenoClosedError";
  }
}

const nextMonthOf = (month: string) => monthOf(addDays(monthBounds(month).to, 1));

/**
 * Makes sure this month and the next have their picks (whoever opens the page first writes them;
 * a race keeps the first row). While a pick is still open its release date follows `CinemaRelease`,
 * so a delayed premiere does not close forecasts early.
 */
export const ensureEstrenos = async (now = new Date()) => {
  const today = mxToday(now);
  const months = [monthOf(today), nextMonthOf(monthOf(today))];
  for (const month of months) {
    const { from, to } = monthBounds(month);
    const existing = await db.select().from(juegoEstrenos).where(eq(juegoEstrenos.month, month));
    const candidates = await db
      .select({ catalogId: cinemaReleases.catalogId, mxReleaseDate: cinemaReleases.mxReleaseDate, popularity: cinemaReleases.popularity })
      .from(cinemaReleases)
      .innerJoin(catalog, eq(catalog.id, cinemaReleases.catalogId))
      .where(
        and(
          gte(cinemaReleases.mxReleaseDate, from),
          lte(cinemaReleases.mxReleaseDate, to),
          ne(cinemaReleases.status, "gone"),
          eq(catalog.kind, "MOVIE"),
        ),
      );
    const byId = new Map(candidates.map((candidate) => [candidate.catalogId, candidate]));
    for (const row of existing) {
      const current = byId.get(row.catalogId);
      if (current && current.mxReleaseDate !== row.releaseDate && isForecastOpen(row.releaseDate, today) && row.actual == null) {
        await db
          .update(juegoEstrenos)
          .set({ releaseDate: current.mxReleaseDate, resolveOn: resolveOnOf(current.mxReleaseDate), month: monthOf(current.mxReleaseDate) })
          .where(eq(juegoEstrenos.catalogId, row.catalogId));
      }
    }
    const picks = pickEstrenos({ month, today, existing: existing.map((row) => row.catalogId), candidates });
    if (picks.length > 0) {
      await db
        .insert(juegoEstrenos)
        .values(
          picks.map((pick) => ({
            catalogId: pick.catalogId,
            month,
            releaseDate: pick.mxReleaseDate,
            resolveOn: resolveOnOf(pick.mxReleaseDate),
            createdAt: now,
          })),
        )
        .onConflictDoNothing();
    }
  }
};

/** Saves or changes the person's forecast; refused from the release day on. */
export const savePronostico = async (input: { userId: string; catalogId: string; guess: number; now?: Date }) => {
  const now = input.now ?? new Date();
  const estreno = await db.query.juegoEstrenos.findFirst({ where: eq(juegoEstrenos.catalogId, input.catalogId) });
  if (!estreno) throw new Error("Ese estreno no está en la quiniela.");
  if (!isForecastOpen(estreno.releaseDate, mxToday(now)) || estreno.actual != null) throw new EstrenoClosedError();
  await db
    .insert(juegoPronosticos)
    .values({ id: createId(), catalogId: input.catalogId, userId: input.userId, guess: input.guess, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [juegoPronosticos.catalogId, juegoPronosticos.userId],
      set: { guess: input.guess, updatedAt: now },
    });
};

export type EstrenoForecast = {
  userId: string;
  name: string;
  initial: string;
  guess: number;
  me: boolean;
  /** Resolved only: among the closest. */
  winner: boolean;
};

export type EstrenoCard = {
  catalogId: string;
  name: string;
  posterPath: string | null;
  releaseDate: string;
  phase: EstrenoPhase;
  chip: string;
  /** Tenths, or null before the person saves one. */
  mine: number | null;
  /** Tenths, once resolved. */
  actual: number | null;
  /** How many saved a forecast (always sent; it gives nothing away). */
  votes: number;
  /** Others' forecasts: empty until the person saved theirs or forecasts closed. */
  others: EstrenoForecast[];
  /** False while others are hidden, so the UI can say why. */
  revealed: boolean;
  /** Resolved only: the person was among the closest. */
  iWon: boolean;
  winners: string[];
};

/**
 * What one person sees: this month's and next month's picks, plus releases resolved in the last
 * 30 days. Others' guesses are left out on the server (not hidden in the UI) until `mayRevealOthers`.
 */
export const loadEstrenos = async (userId: string, now = new Date()): Promise<EstrenoCard[]> => {
  const today = mxToday(now);
  const since = new Date(now.getTime() - RESOLVED_VISIBLE_DAYS * 86_400_000);
  const rows = await db
    .select({ estreno: juegoEstrenos, name: catalog.name, posterPath: catalog.posterPath })
    .from(juegoEstrenos)
    .innerJoin(catalog, eq(catalog.id, juegoEstrenos.catalogId))
    .where(or(isNull(juegoEstrenos.resolvedAt), gte(juegoEstrenos.resolvedAt, since)))
    .orderBy(asc(juegoEstrenos.releaseDate), asc(juegoEstrenos.catalogId));
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.estreno.catalogId);
  const forecasts = await db
    .select({ catalogId: juegoPronosticos.catalogId, userId: juegoPronosticos.userId, guess: juegoPronosticos.guess, name: users.name })
    .from(juegoPronosticos)
    .innerJoin(users, eq(users.id, juegoPronosticos.userId))
    .where(inArray(juegoPronosticos.catalogId, ids))
    .orderBy(asc(juegoPronosticos.createdAt));
  const people = new Map(forecasts.map((forecast) => [forecast.userId, { id: forecast.userId, name: forecast.name }]));
  const names = retoNames([...people.values()]);

  const cards = rows.map(({ estreno, name, posterPath }): EstrenoCard => {
    const all = forecasts.filter((forecast) => forecast.catalogId === estreno.catalogId);
    const mine = all.find((forecast) => forecast.userId === userId)?.guess ?? null;
    const revealed = mayRevealOthers({ mine, releaseDate: estreno.releaseDate, today });
    const winnerIds = new Set(estreno.actual == null ? [] : closestOf(all, estreno.actual).map((forecast) => forecast.userId));
    const others = revealed
      ? all
          .filter((forecast) => forecast.userId !== userId)
          .map((forecast) => {
            const shown = names.get(forecast.userId) ?? "Alguien";
            return { userId: forecast.userId, name: shown, initial: initialOf(shown), guess: forecast.guess, me: false, winner: winnerIds.has(forecast.userId) };
          })
      : [];
    return {
      catalogId: estreno.catalogId,
      name,
      posterPath,
      releaseDate: estreno.releaseDate,
      phase: estrenoPhase(estreno, today),
      chip: estrenoChip(estreno, today),
      mine,
      actual: estreno.actual,
      votes: all.length,
      others,
      revealed,
      iWon: winnerIds.has(userId),
      winners: [...winnerIds].map((id) => (id === userId ? "Tú" : (names.get(id) ?? "Alguien"))),
    };
  });
  // Open ones first (soonest to close), then closed, then resolved (latest first).
  const order: Record<EstrenoPhase, number> = { abierta: 0, cerrada: 1, pendiente: 2, resuelta: 3 };
  return cards.sort((a, b) => order[a.phase] - order[b.phase] || (a.phase === "resuelta" ? b.releaseDate.localeCompare(a.releaseDate) : a.releaseDate.localeCompare(b.releaseDate)));
};

export type ResolveSummary = { resolved: number; waiting: number };

/**
 * The Extras cron (daily): every release whose 14 days are up gets its IMDb rating from `Catalog`.
 * Without a rating yet it stays pending and is tried again on the next run; nothing fails.
 */
export const resolveEstrenos = async (now = new Date()): Promise<ResolveSummary> => {
  const today = mxToday(now);
  const due = await db
    .select({ catalogId: juegoEstrenos.catalogId, imdbRating: catalog.imdbRating })
    .from(juegoEstrenos)
    .innerJoin(catalog, eq(catalog.id, juegoEstrenos.catalogId))
    .where(and(isNull(juegoEstrenos.actual), lte(juegoEstrenos.resolveOn, today)));
  let resolved = 0;
  for (const row of due) {
    if (row.imdbRating == null || row.imdbRating <= 0) continue;
    await db
      .update(juegoEstrenos)
      .set({ actual: ratingToTenths(row.imdbRating), resolvedAt: now })
      .where(and(eq(juegoEstrenos.catalogId, row.catalogId), isNull(juegoEstrenos.actual)));
    resolved += 1;
  }
  return { resolved, waiting: due.length - resolved };
};

/** Portada chip: open releases the person has not forecast yet. */
export const countOpenWithoutForecast = async (userId: string, now = new Date()) => {
  const today = mxToday(now);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(juegoEstrenos)
    .leftJoin(juegoPronosticos, and(eq(juegoPronosticos.catalogId, juegoEstrenos.catalogId), eq(juegoPronosticos.userId, userId)))
    .where(and(sql`${juegoEstrenos.releaseDate} > ${today}`, isNull(juegoPronosticos.id)));
  return row?.count ?? 0;
};
