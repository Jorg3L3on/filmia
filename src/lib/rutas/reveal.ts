import { eq } from "drizzle-orm";
import { db, users, type Platform } from "@/db";
import {
  filmNameInSaga,
  findThread,
  parseThreadPeople,
  personRoleFilms,
  personRoleOfThread,
  threadLine,
  todayIso,
} from "@/lib/rutas/core";
import { loadWatchedFilms, platformLabelOf } from "@/lib/people/store";
import { loadRutas, type RutaStepView, type RutaView } from "@/lib/rutas/store";
import { parseStoredStreamingPlatforms } from "@/lib/streaming-platforms";
import { getTmdbPersonCredits, isTmdbConfigured } from "@/lib/tmdb";
import { withTimeout } from "@/lib/with-timeout";

/** A step as the reveal sheet and the ruta page show it. */
export type RutaStepCard = {
  catalogId: string;
  titleId: string | null;
  tmdbId: number;
  name: string;
  /** Inside a saga, without the saga's name («Las dos torres»). */
  displayName: string;
  year: number | null;
  runtimeMinutes: number | null;
  posterPath: string | null;
  originalName: string | null;
  backdropPath: string | null;
  overview: string | null;
  /** «HBO Max», on one of your platforms when it can be. */
  platformLabel: string | null;
  why: string;
  hint: string;
};

export type RutaReveal = {
  rutaId: string;
  title: string;
  done: number;
  total: number;
  closed: boolean;
  /** The film just marked, when it is a step of this ruta. */
  seenName: string | null;
  /** The step that just turned face up (the next to watch). */
  next: RutaStepCard | null;
  /** «Andrew Lesnie fotografió las dos. Con esta llevas 2 de sus 18.» */
  thread: string | null;
};

/** A film's name as a ruta says it: a saga's films drop the saga's name. */
export const stepFilmName = (view: Pick<RutaView, "kind" | "shortTitle">, step: Pick<RutaStepView, "film">) =>
  view.kind === "coleccion" ? filmNameInSaga(step.film.name, view.shortTitle) : step.film.name;

export const toStepCard = (
  view: Pick<RutaView, "kind" | "shortTitle">,
  step: RutaStepView,
  userPlatforms: readonly Platform[],
): RutaStepCard => ({
  catalogId: step.catalogId,
  titleId: step.titleId,
  tmdbId: step.film.tmdbId,
  name: step.film.name,
  displayName: stepFilmName(view, step),
  year: step.film.year,
  runtimeMinutes: step.film.runtimeMinutes,
  posterPath: step.film.posterPath,
  originalName: step.film.originalName,
  backdropPath: step.film.backdropPath,
  overview: step.film.overview,
  platformLabel: platformLabelOf(step.film, userPlatforms),
  why: step.why,
  hint: step.hint,
});

const THREAD_BUDGET_MS = 1200;

/** «n de N» for the thread person: their films in that role (TMDB, cached), within a budget. */
const totalFor = async (personId: number, role: ReturnType<typeof personRoleOfThread>) => {
  if (!isTmdbConfigured()) {
    return null;
  }
  return withTimeout(
    getTmdbPersonCredits(personId).then((data) => personRoleFilms(data.credits, role, todayIso()).length),
    THREAD_BUDGET_MS,
    null,
  );
};

const threadFor = async (userId: string, view: RutaView, seen: RutaStepView, next: RutaStepView | null) => {
  const watched = await loadWatchedFilms(userId, [seen.catalogId]);
  const thread = findThread(
    { catalogId: seen.catalogId, name: seen.film.name, people: parseThreadPeople(seen.film.tmdbPeople) },
    watched.map(({ film }) => ({ catalogId: film.id, name: film.name, people: parseThreadPeople(film.tmdbPeople) })),
    next ? { catalogId: next.catalogId, name: next.film.name, people: parseThreadPeople(next.film.tmdbPeople) } : null,
  );
  if (!thread) {
    return null;
  }
  return threadLine(thread, await totalFor(thread.person.id, personRoleOfThread(thread.person.role)));
};

/**
 * After «Vi esto» on a ruta card: read the ruta (which stamps the step done and, on the last
 * one, closes it), then say what flipped and who ties it to the rest. `cardId` is the card's
 * id: the person's title id, or the film's catalog id when they had not saved it.
 */
export const revealAfterWatch = async (userId: string, rutaId: string, cardId: string): Promise<RutaReveal | null> => {
  const [view] = await loadRutas(userId, { ids: [rutaId] });
  if (!view) {
    return null;
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { streamingPlatforms: true } });
  const platforms = parseStoredStreamingPlatforms(user?.streamingPlatforms);
  const seen = view.steps.find((step) => step.catalogId === cardId || step.titleId === cardId) ?? null;
  const next = view.progress.nextIndex == null ? null : (view.steps[view.progress.nextIndex] ?? null);
  return {
    rutaId: view.id,
    title: view.title,
    done: view.progress.done,
    total: view.progress.total,
    closed: view.progress.closed,
    seenName: seen ? stepFilmName(view, seen) : null,
    next: next ? toStepCard(view, next, platforms) : null,
    thread: seen && seen.state === "done" ? await threadFor(userId, view, seen, next).catch(() => null) : null,
  };
};
