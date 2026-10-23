import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import {
  catalog,
  db,
  pickEvents,
  rutaPasos,
  rutas,
  titles,
  users,
  type CatalogRow,
  type RutaRow,
} from "@/db";
import { scheduleCatalogEnrichment } from "@/lib/catalog-enrich";
import { catalogIdFor, findOrCreateCatalog } from "@/lib/catalog";
import {
  isRutaKind,
  isRutaStatus,
  MAX_ACTIVE_RUTAS,
  rutaProgress,
  stampChanges,
  statusForNewRuta,
  stepStates,
  type RutaDraft,
  type RutaEventKind,
  type RutaKind,
  type RutaProgress,
  type RutaStatus,
  type RutaStepState,
} from "@/lib/rutas/core";

/** One step as the screens read it: the film (from `Catalog`) and where the person stands. */
export type RutaStepView = {
  position: number;
  catalogId: string;
  film: CatalogRow;
  why: string;
  hint: string;
  state: RutaStepState;
  /** The person's own entry for the film, when they have one. */
  titleId: string | null;
  watchedAt: Date | null;
  revealedAt: Date | null;
  doneAt: Date | null;
};

export type RutaView = {
  id: string;
  kind: RutaKind;
  title: string;
  shortTitle: string;
  reason: string | null;
  sourceKey: string;
  seedCatalogId: string | null;
  status: RutaStatus;
  startedAt: Date;
  closedAt: Date | null;
  steps: RutaStepView[];
  progress: RutaProgress;
  /** The latest step marked, else when it started: Hoy shows the freshest ruta first. */
  lastActivityAt: Date;
};

/** How a ruta began, for `PickEvent.lens` (`ruta:coleccion:hoy`). */
export type RutaVia = "hoy" | "bienvenida" | "cierre" | "ruta";

const eventLens = (kind: RutaKind, via?: RutaVia) => (via ? `ruta:${kind}:${via}` : `ruta:${kind}`);

const toStatus = (value: string): RutaStatus => (isRutaStatus(value) ? value : "espera");

const toKind = (value: string): RutaKind => (isRutaKind(value) ? value : "curada");

type LoadOptions = {
  ids?: readonly string[];
  statuses?: readonly RutaStatus[];
  /** Write the stamps (done / revealed / closed) that changed since the last read. Default true. */
  sync?: boolean;
  now?: Date;
};

/**
 * The person's rutas with their steps, the films and what is watched. Stamps that no longer
 * match (a step seen from Buscar, a ruta just finished) are written before returning, so every
 * screen reads the same state: closing a ruta promotes the oldest waiting one.
 */
export const loadRutas = async (userId: string, options: LoadOptions = {}): Promise<RutaView[]> => {
  const now = options.now ?? new Date();
  const filters = [eq(rutas.userId, userId)];
  if (options.ids) {
    if (options.ids.length === 0) {
      return [];
    }
    filters.push(inArray(rutas.id, [...options.ids]));
  }
  if (options.statuses) {
    filters.push(inArray(rutas.status, [...options.statuses]));
  }
  const rows = await db.query.rutas.findMany({ where: and(...filters), orderBy: [asc(rutas.createdAt)] });
  if (rows.length === 0) {
    return [];
  }

  const stepRows = await db
    .select({ step: rutaPasos, film: catalog })
    .from(rutaPasos)
    .innerJoin(catalog, eq(rutaPasos.catalogId, catalog.id))
    .where(inArray(rutaPasos.rutaId, rows.map((row) => row.id)))
    .orderBy(asc(rutaPasos.rutaId), asc(rutaPasos.position));

  const catalogIds = [...new Set(stepRows.map((row) => row.step.catalogId))];
  const owned = catalogIds.length
    ? await db.query.titles.findMany({
        where: and(eq(titles.userId, userId), inArray(titles.catalogId, catalogIds)),
        columns: { id: true, catalogId: true, watchedAt: true },
      })
    : [];
  const ownedByCatalog = new Map(owned.map((row) => [row.catalogId, row]));

  const views = rows.map((row) => toView(row, stepRows.filter((item) => item.step.rutaId === row.id), ownedByCatalog));
  if (options.sync === false) {
    return views;
  }
  return syncRutas(userId, views, now);
};

const toView = (
  row: RutaRow,
  steps: ReadonlyArray<{ step: typeof rutaPasos.$inferSelect; film: CatalogRow }>,
  ownedByCatalog: ReadonlyMap<string, { id: string; watchedAt: Date | null }>,
): RutaView => {
  const watched = steps.map(({ step }) => Boolean(ownedByCatalog.get(step.catalogId)?.watchedAt));
  const states = stepStates(watched);
  const stepViews = steps.map(({ step, film }, index): RutaStepView => {
    const own = ownedByCatalog.get(step.catalogId);
    return {
      position: step.position,
      catalogId: step.catalogId,
      film,
      why: step.why,
      hint: step.hint,
      state: states[index] ?? "hidden",
      titleId: own?.id ?? null,
      watchedAt: own?.watchedAt ?? null,
      revealedAt: step.revealedAt,
      doneAt: step.doneAt,
    };
  });
  const lastDone = stepViews.reduce<Date | null>(
    (latest, step) => (step.doneAt && (!latest || step.doneAt > latest) ? step.doneAt : latest),
    null,
  );
  return {
    id: row.id,
    kind: toKind(row.kind),
    title: row.title,
    shortTitle: row.shortTitle,
    reason: row.reason,
    sourceKey: row.sourceKey,
    seedCatalogId: row.seedCatalogId,
    status: toStatus(row.status),
    startedAt: row.startedAt,
    closedAt: row.closedAt,
    steps: stepViews,
    progress: rutaProgress(watched),
    lastActivityAt: lastDone && lastDone > row.startedAt ? lastDone : row.startedAt,
  };
};

const rutaEvent = (
  userId: string,
  kind: RutaEventKind,
  ruta: Pick<RutaView, "kind">,
  step: { catalogId: string; titleId: string | null } | null,
  now: Date,
  via?: RutaVia,
) => ({
  id: createId(),
  userId,
  titleId: step?.titleId ?? null,
  catalogId: step?.catalogId ?? null,
  kind,
  lens: eventLens(ruta.kind, via),
  createdAt: now,
});

/**
 * Bring the stamps in line with what is watched: reveal, mark done (one `ruta_step_done` each),
 * close (`ruta_closed`) and, for every ruta that closed, promote the oldest waiting one. Closed
 * rutas are left alone: an undo after the last step does not reopen them (only gain, never lose).
 */
const syncRutas = async (userId: string, views: RutaView[], now: Date): Promise<RutaView[]> => {
  const queries: Parameters<typeof db.batch>[0][number][] = [];
  const events: ReturnType<typeof rutaEvent>[] = [];
  let closedCount = 0;

  const synced = views.map((view) => {
    if (view.status === "cerrada") {
      return view;
    }
    const changes = stampChanges(
      view.steps.map((step) => ({
        position: step.position,
        revealedAt: step.revealedAt,
        doneAt: step.doneAt,
      })),
      view.steps.map((step) => step.state === "done"),
      view.closedAt,
    );
    const revealed = changes.revealed;
    if (revealed.length > 0) {
      queries.push(
        db
          .update(rutaPasos)
          .set({ revealedAt: now })
          .where(and(eq(rutaPasos.rutaId, view.id), inArray(rutaPasos.position, revealed), isNull(rutaPasos.revealedAt))),
      );
    }
    if (changes.done.length > 0) {
      queries.push(
        db
          .update(rutaPasos)
          .set({ doneAt: now })
          .where(and(eq(rutaPasos.rutaId, view.id), inArray(rutaPasos.position, changes.done))),
      );
      for (const position of changes.done) {
        const step = view.steps.find((item) => item.position === position);
        if (step) {
          events.push(rutaEvent(userId, "ruta_step_done", view, step, now));
        }
      }
    }
    if (changes.undone.length > 0) {
      queries.push(
        db
          .update(rutaPasos)
          .set({ doneAt: null })
          .where(and(eq(rutaPasos.rutaId, view.id), inArray(rutaPasos.position, changes.undone))),
      );
    }
    if (changes.close) {
      closedCount += 1;
      queries.push(
        db.update(rutas).set({ status: "cerrada", closedAt: now }).where(eq(rutas.id, view.id)),
      );
      const last = view.steps.at(-1);
      events.push(rutaEvent(userId, "ruta_closed", view, last ?? null, now));
    }
    const done = new Set(changes.done);
    const undone = new Set(changes.undone);
    const shown = new Set(revealed);
    return {
      ...view,
      status: changes.close ? ("cerrada" as const) : view.status,
      closedAt: changes.close ? now : view.closedAt,
      steps: view.steps.map((step) => ({
        ...step,
        revealedAt: shown.has(step.position) ? now : step.revealedAt,
        doneAt: done.has(step.position) ? now : undone.has(step.position) ? null : step.doneAt,
      })),
    };
  });

  if (events.length > 0) {
    queries.push(db.insert(pickEvents).values(events));
  }
  if (queries.length > 0) {
    await db.batch(queries as [(typeof queries)[number], ...(typeof queries)[number][]]);
  }
  if (closedCount > 0) {
    await promoteWaiting(userId);
  }
  return synced;
};

/** Fill the free active slots with the oldest waiting rutas (no push, no badge). */
export const promoteWaiting = async (userId: string) => {
  const active = await countActive(userId);
  const free = MAX_ACTIVE_RUTAS - active;
  if (free <= 0) {
    return [];
  }
  const waiting = await db.query.rutas.findMany({
    where: and(eq(rutas.userId, userId), eq(rutas.status, "espera")),
    orderBy: [asc(rutas.createdAt)],
    limit: free,
    columns: { id: true },
  });
  if (waiting.length === 0) {
    return [];
  }
  const ids = waiting.map((row) => row.id);
  await db.update(rutas).set({ status: "activa" }).where(inArray(rutas.id, ids));
  return ids;
};

export const countActive = async (userId: string) => {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rutas)
    .where(and(eq(rutas.userId, userId), eq(rutas.status, "activa")));
  return rows[0]?.count ?? 0;
};

/**
 * Has this person ever had a ruta, or been offered the first one? Then Hoy never builds it for
 * them. Nor while they are still in the Bienvenida: its last step offers it (and its payoff reads Hoy).
 */
export const rutasAlreadyOffered = async (userId: string) => {
  const [user, any] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { rutasOfferedAt: true, onboardedAt: true } }),
    db.query.rutas.findFirst({ where: eq(rutas.userId, userId), columns: { id: true } }),
  ]);
  return Boolean(user?.rutasOfferedAt || any || !user?.onboardedAt);
};

export const markRutasOffered = async (userId: string, now = new Date()) => {
  await db
    .update(users)
    .set({ rutasOfferedAt: now })
    .where(and(eq(users.id, userId), isNull(users.rutasOfferedAt)));
};

export type CreatedRuta = { id: string; created: boolean; status: RutaStatus };

/**
 * Store a draft: one `Catalog` row per film (enriched after the response when new), the ruta
 * active while there is room (else waiting), its steps with what is already seen stamped done,
 * and `ruta_started`. A source the person already has returns that ruta instead.
 */
export const createRuta = async (
  userId: string,
  draft: RutaDraft,
  options: { via: RutaVia; now?: Date } = { via: "ruta" },
): Promise<CreatedRuta> => {
  const now = options.now ?? new Date();
  const existing = await db.query.rutas.findFirst({
    where: and(eq(rutas.userId, userId), eq(rutas.sourceKey, draft.sourceKey)),
    columns: { id: true, status: true },
  });
  if (existing) {
    return { id: existing.id, created: false, status: toStatus(existing.status) };
  }

  const films: CatalogRow[] = [];
  for (const step of draft.steps) {
    const { row, created } = await findOrCreateCatalog({
      tmdbId: step.film.tmdbId,
      kind: "MOVIE",
      name: step.film.name,
      originalName: step.film.originalName,
      year: step.film.year,
      posterPath: step.film.posterPath,
    });
    if (created) {
      scheduleCatalogEnrichment(row);
    }
    films.push(row);
  }

  const owned = await db.query.titles.findMany({
    where: and(eq(titles.userId, userId), inArray(titles.catalogId, films.map((film) => film.id))),
    columns: { id: true, catalogId: true, watchedAt: true },
  });
  const ownedByCatalog = new Map(owned.map((row) => [row.catalogId, row]));
  const watched = films.map((film) => Boolean(ownedByCatalog.get(film.id)?.watchedAt));
  const states = stepStates(watched);

  const status = statusForNewRuta(await countActive(userId));
  const id = createId();
  const seedCatalogId = draft.seedTmdbId
    ? await existingCatalogId(catalogIdFor("MOVIE", draft.seedTmdbId))
    : null;
  const inserted = await db
    .insert(rutas)
    .values({
      id,
      userId,
      kind: draft.kind,
      title: draft.title,
      shortTitle: draft.shortTitle,
      reason: draft.reason,
      sourceKey: draft.sourceKey,
      seedCatalogId,
      status,
      startedAt: now,
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: rutas.id });
  if (inserted.length === 0) {
    // Two taps raced on the same source: the other one won.
    const winner = await db.query.rutas.findFirst({
      where: and(eq(rutas.userId, userId), eq(rutas.sourceKey, draft.sourceKey)),
      columns: { id: true, status: true },
    });
    if (!winner) {
      throw new Error("No se pudo guardar la ruta.");
    }
    return { id: winner.id, created: false, status: toStatus(winner.status) };
  }

  const nextIndex = states.indexOf("next");
  const nextFilm = nextIndex >= 0 ? films[nextIndex] : undefined;
  await db.batch([
    db.insert(rutaPasos).values(
      draft.steps.map((step, index) => ({
        rutaId: id,
        position: index,
        catalogId: films[index]!.id,
        why: step.why,
        hint: step.hint,
        revealedAt: states[index] === "hidden" ? null : now,
        doneAt: states[index] === "done" ? now : null,
      })),
    ),
    db.insert(pickEvents).values(
      rutaEvent(
        userId,
        "ruta_started",
        { kind: draft.kind },
        nextFilm ? { catalogId: nextFilm.id, titleId: ownedByCatalog.get(nextFilm.id)?.id ?? null } : null,
        now,
        options.via,
      ),
    ),
    db
      .update(users)
      .set({ rutasOfferedAt: now })
      .where(and(eq(users.id, userId), isNull(users.rutasOfferedAt))),
  ]);
  return { id, created: true, status };
};

const existingCatalogId = async (id: string) => {
  const row = await db.query.catalog.findFirst({ where: eq(catalog.id, id), columns: { id: true } });
  return row?.id ?? null;
};

/** The person's sources already used, so offers never repeat a ruta they have. */
export const loadSourceKeys = async (userId: string) => {
  const rows = await db.query.rutas.findMany({
    where: eq(rutas.userId, userId),
    columns: { sourceKey: true },
  });
  return new Set(rows.map((row) => row.sourceKey));
};

/** Put a waiting ruta in Hoy now, if there is room (from its own page). */
export const activateRuta = async (userId: string, rutaId: string) => {
  const active = await countActive(userId);
  if (active >= MAX_ACTIVE_RUTAS) {
    return false;
  }
  const updated = await db
    .update(rutas)
    .set({ status: "activa" })
    .where(and(eq(rutas.id, rutaId), eq(rutas.userId, userId), eq(rutas.status, "espera")))
    .returning({ id: rutas.id });
  return updated.length > 0;
};

/** Take an active ruta out of Hoy («Dejar para después»): it waits, nothing is lost. */
export const parkRuta = async (userId: string, rutaId: string) => {
  const updated = await db
    .update(rutas)
    .set({ status: "espera" })
    .where(and(eq(rutas.id, rutaId), eq(rutas.userId, userId), eq(rutas.status, "activa")))
    .returning({ id: rutas.id });
  return updated.length > 0;
};

/** Watched films of the person (catalog rows), for the thread and the offers. */
export const loadWatchedFilms = async (userId: string, excludeCatalogIds: readonly string[] = []) => {
  const rows = await db
    .select({ title: titles, film: catalog })
    .from(titles)
    .innerJoin(catalog, eq(titles.catalogId, catalog.id))
    .where(
      and(
        eq(titles.userId, userId),
        isNotNull(titles.watchedAt),
        eq(catalog.kind, "MOVIE"),
        ...(excludeCatalogIds.length ? [notInArray(catalog.id, [...excludeCatalogIds])] : []),
      ),
    );
  return rows;
};


/** How many rutas the person has in each state (Perfil, Quiero ver); no stamps written. */
export const countRutasByStatus = async (userId: string): Promise<Record<RutaStatus, number>> => {
  const rows = await db
    .select({ status: rutas.status, count: sql<number>`count(*)::int` })
    .from(rutas)
    .where(eq(rutas.userId, userId))
    .groupBy(rutas.status);
  const counts: Record<RutaStatus, number> = { activa: 0, espera: 0, cerrada: 0 };
  for (const row of rows) {
    counts[toStatus(row.status)] += row.count;
  }
  return counts;
};
