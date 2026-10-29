import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, gte, inArray, ne } from "drizzle-orm";
import { catalog, cinemaReleases, db, pickEvents, pushSubscriptions } from "@/db";
import { mxToday } from "@/lib/cine-core";
import {
  countdownsFor,
  premierePayload,
  type Countdown,
  type CountdownRelease,
  type UniversePerson,
} from "@/lib/cine-cuenta";
import { isPushConfigured, sendPush, type PushPayload, type PushSendOutcome } from "@/lib/push/web-push";
import { parseThreadPeople } from "@/lib/people/core";
import { loadUniversoFilms } from "@/lib/universo/store";

/**
 * Cuenta regresiva, server side (FIL-I26-5). «Avísame el día» is a `cine_avisame` event; the daily
 * Cine cron pushes on the premiere day and records `cine_avisado` so it never repeats.
 */

const REMIND_KIND = "cine_avisame";
const REMINDED_KIND = "cine_avisado";

export type CountdownView = Countdown & {
  reminded: boolean;
};

/** The people of your universe by id, with the films of yours they are in (oldest watch first). */
const universePeople = async (userId: string) => {
  const films = await loadUniversoFilms(userId);
  const ordered = [...films].sort((a, b) => a.watchedAt.getTime() - b.watchedAt.getTime());
  const people = new Map<number, UniversePerson>();
  for (const film of ordered) {
    for (const person of film.people) {
      const current = people.get(person.id);
      if (current) {
        current.films.push(film.name);
      } else {
        people.set(person.id, { id: person.id, name: person.name, role: person.role, films: [film.name] });
      }
    }
  }
  return people;
};

/** Cine's «Para ti, en sala»: premieres from today on with someone of your universe behind them. */
export const loadCountdowns = async (userId: string, now = new Date()): Promise<CountdownView[]> => {
  const today = mxToday(now);
  const [people, rows] = await Promise.all([
    universePeople(userId),
    db
      .select({ release: cinemaReleases, film: catalog })
      .from(cinemaReleases)
      .innerJoin(catalog, eq(cinemaReleases.catalogId, catalog.id))
      .where(and(ne(cinemaReleases.status, "gone"), gte(cinemaReleases.mxReleaseDate, today)))
      .orderBy(asc(cinemaReleases.mxReleaseDate)),
  ]);
  if (people.size === 0) {
    return [];
  }
  const releases: CountdownRelease[] = rows.map(({ release, film }) => ({
    catalogId: film.id,
    tmdbId: film.tmdbId,
    name: film.name,
    posterPath: film.posterPath,
    mxReleaseDate: release.mxReleaseDate,
    people: parseThreadPeople(film.tmdbPeople),
  }));
  const countdowns = countdownsFor(releases, people, today);
  if (countdowns.length === 0) {
    return [];
  }
  const reminders = await db.query.pickEvents.findMany({
    where: and(
      eq(pickEvents.userId, userId),
      eq(pickEvents.kind, REMIND_KIND),
      inArray(pickEvents.catalogId, countdowns.map((item) => item.release.catalogId)),
    ),
    columns: { catalogId: true },
  });
  const reminded = new Set(reminders.map((row) => row.catalogId));
  return countdowns.map((item) => ({ ...item, reminded: reminded.has(item.release.catalogId) }));
};

export type RemindOutcome =
  | { ok: true; mxReleaseDate: string; pushReady: boolean }
  | { ok: false; error: string };

/** «Avísame el día»: once per film; says whether a device can receive it. */
export const remindPremiere = async (userId: string, catalogId: string, now = new Date()): Promise<RemindOutcome> => {
  const release = await db.query.cinemaReleases.findFirst({ where: eq(cinemaReleases.catalogId, catalogId) });
  if (!release || release.status === "gone" || release.mxReleaseDate < mxToday(now)) {
    return { ok: false, error: "Esa película ya no tiene estreno por delante." };
  }
  const existing = await db.query.pickEvents.findFirst({
    where: and(eq(pickEvents.userId, userId), eq(pickEvents.kind, REMIND_KIND), eq(pickEvents.catalogId, catalogId)),
    columns: { id: true },
  });
  if (!existing) {
    await db.insert(pickEvents).values({
      id: createId(),
      userId,
      titleId: null,
      catalogId,
      kind: REMIND_KIND,
      lens: "cine",
      createdAt: now,
    });
  }
  const device = await db.query.pushSubscriptions.findFirst({
    where: eq(pushSubscriptions.userId, userId),
    columns: { id: true },
  });
  return { ok: true, mxReleaseDate: release.mxReleaseDate, pushReady: Boolean(device) };
};

export type PremiereRemindersSummary = {
  skipped?: "push_not_configured";
  due: number;
  sent: number;
  gone: number;
  failed: number;
};

type Sender = (
  subscription: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
) => Promise<PushSendOutcome>;

/**
 * Cron step: today's premieres someone asked to be told about. A reminder counts as done once a
 * device took it (`cine_avisado` with the day), so a failed run tries again tomorrow only if the
 * date moved; gone devices are deleted like the other pushes.
 */
export const notifyPremiereReminders = async (
  now = new Date(),
  send: Sender = sendPush,
  { requirePushConfig = true }: { requirePushConfig?: boolean } = {},
): Promise<PremiereRemindersSummary> => {
  const summary: PremiereRemindersSummary = { due: 0, sent: 0, gone: 0, failed: 0 };
  if (requirePushConfig && !isPushConfigured()) {
    return { ...summary, skipped: "push_not_configured" };
  }
  const today = mxToday(now);
  const due = await db
    .select({ userId: pickEvents.userId, catalogId: catalog.id, name: catalog.name })
    .from(pickEvents)
    .innerJoin(cinemaReleases, eq(cinemaReleases.catalogId, pickEvents.catalogId))
    .innerJoin(catalog, eq(catalog.id, pickEvents.catalogId))
    .where(and(eq(pickEvents.kind, REMIND_KIND), eq(cinemaReleases.mxReleaseDate, today), ne(cinemaReleases.status, "gone")));
  const done = due.length
    ? await db.query.pickEvents.findMany({
        where: and(eq(pickEvents.kind, REMINDED_KIND), eq(pickEvents.lens, `cine:${today}`)),
        columns: { userId: true, catalogId: true },
      })
    : [];
  const doneKeys = new Set(done.map((row) => `${row.userId}:${row.catalogId}`));
  const pending = [...new Map(due.map((row) => [`${row.userId}:${row.catalogId}`, row])).values()].filter(
    (row) => !doneKeys.has(`${row.userId}:${row.catalogId}`),
  );
  summary.due = pending.length;

  for (const row of pending) {
    const subscriptions = await db
      .select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, row.userId));
    const reason = (await loadCountdowns(row.userId, now).catch(() => [])).find(
      (item) => item.release.catalogId === row.catalogId,
    )?.reason;
    const payload = premierePayload(row, reason ?? null);
    let delivered = false;
    const gone: string[] = [];
    for (const subscription of subscriptions) {
      const outcome = await send(subscription, payload);
      summary[outcome === "sent" ? "sent" : outcome === "gone" ? "gone" : "failed"] += 1;
      if (outcome === "sent") delivered = true;
      if (outcome === "gone") gone.push(subscription.id);
    }
    if (gone.length > 0) {
      await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
    }
    if (delivered) {
      await db.insert(pickEvents).values({
        id: createId(),
        userId: row.userId,
        titleId: null,
        catalogId: row.catalogId,
        kind: REMINDED_KIND,
        lens: `cine:${today}`,
        createdAt: now,
      });
    }
  }
  return summary;
};
