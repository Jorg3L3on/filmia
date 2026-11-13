import { and, gte, inArray } from "drizzle-orm";
import { db, pickEvents } from "@/db";
import { addDays } from "@/lib/cine-core";
import { JUEGOS_OPENED_KIND, mxDayStart, weekKeyOf } from "@/lib/juegos/core";
import { parseTandaLens, TANDA_ANSWERED_KIND, TANDA_DEALT_KIND } from "@/lib/juegos/tanda/core";

/**
 * `npm run metrics:juegos` (FIL-I50-6): per Mexico City week, visits to Juegos (and through which
 * door of Hoy), tandas started and finished, and how many came back the next week. Aggregates
 * only: user ids are counted, never printed.
 */

export type JuegosEvent = { userId: string; kind: string; lens: string | null; createdAt: Date };

export type JuegosWeek = {
  week: string;
  visits: number;
  viaBoton: number;
  viaBloque: number;
  /** People who answered at least one card of that week's tanda. */
  started: number;
  /** People who answered every card dealt to them that week. */
  finished: number;
  /** Of the people active in Juegos that week, how many were active again the next; null while that week is not over. */
  returned7d: number | null;
};

const ACTIVE_KINDS = new Set([JUEGOS_OPENED_KIND, TANDA_ANSWERED_KIND]);

/** Pure: the report from the events, for the `weeks` Monday keys given (oldest first). */
export const juegosMetrics = (events: readonly JuegosEvent[], weeks: readonly string[], currentWeek: string): JuegosWeek[] => {
  const activeByWeek = new Map<string, Set<string>>();
  for (const event of events) {
    if (!ACTIVE_KINDS.has(event.kind)) continue;
    const week = weekKeyOf(event.createdAt);
    const set = activeByWeek.get(week) ?? new Set<string>();
    set.add(event.userId);
    activeByWeek.set(week, set);
  }
  return weeks.map((week) => {
    const inWeek = events.filter((event) => weekKeyOf(event.createdAt) === week);
    const visits = inWeek.filter((event) => event.kind === JUEGOS_OPENED_KIND);
    const dealt = new Map<string, number>();
    const answered = new Map<string, number>();
    for (const event of events) {
      const lens = parseTandaLens(event.lens);
      if (lens.week !== week) continue;
      if (event.kind === TANDA_DEALT_KIND) dealt.set(event.userId, (dealt.get(event.userId) ?? 0) + 1);
      // One event per answered card (Deshacer deletes its event).
      if (event.kind === TANDA_ANSWERED_KIND) answered.set(event.userId, (answered.get(event.userId) ?? 0) + 1);
    }
    const finished = [...answered.entries()].filter(([userId, count]) => count >= (dealt.get(userId) ?? Infinity)).length;
    const next = addDays(week, 7);
    const active = activeByWeek.get(week) ?? new Set<string>();
    const activeNext = activeByWeek.get(next) ?? new Set<string>();
    return {
      week,
      visits: visits.length,
      viaBoton: visits.filter((event) => event.lens === "boton").length,
      viaBloque: visits.filter((event) => event.lens === "bloque").length,
      started: answered.size,
      finished,
      returned7d: next >= currentWeek ? null : [...active].filter((userId) => activeNext.has(userId)).length,
    };
  });
};

export const loadJuegosMetrics = async (now = new Date(), weekCount = 6) => {
  const current = weekKeyOf(now);
  const weeks = Array.from({ length: weekCount }, (_, index) => addDays(current, -7 * (weekCount - 1 - index)));
  const events = await db
    .select({ userId: pickEvents.userId, kind: pickEvents.kind, lens: pickEvents.lens, createdAt: pickEvents.createdAt })
    .from(pickEvents)
    .where(
      and(
        inArray(pickEvents.kind, [JUEGOS_OPENED_KIND, TANDA_DEALT_KIND, TANDA_ANSWERED_KIND]),
        gte(pickEvents.createdAt, mxDayStart(weeks[0]!)),
      ),
    );
  return { weeks: juegosMetrics(events, weeks, current) };
};
