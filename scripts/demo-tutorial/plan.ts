import { randomBytes } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { and, count, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import {
  catalog,
  db,
  listInvites,
  listItems,
  listJoinRequests,
  listMembers,
  lists,
  pushSubscriptions,
  titles,
  users,
  type ListKind,
  type ListRole,
  type Platform,
  type SeriesStatus,
  type TitleKind,
} from "../../src/db/index";
import { hashPassword } from "../../src/lib/auth/password";
import { catalogIdFor } from "../../src/lib/catalog-core";
import { YEAR_TOP_SIZE, yearTopName, yearTopSlug } from "../../src/lib/cine-top";
import { WATCHLIST_SLUG } from "../../src/lib/lists";
import {
  DEMO_EMAIL,
  DEMO_PLATFORMS,
  DEMO_USER_ID,
  FRIENDS,
  QUEUE,
  SHARED_ITEMS,
  SHARED_LIST_DESCRIPTION,
  SHARED_LIST_NAME,
  TOP_YEAR,
  WATCHED,
  WATCHED_2026,
  type DemoFilm,
  type FriendSeed,
  type WatchedSeed,
} from "./data";

/**
 * FIL-I38 · Plans and applies the tutorial data for the demo account.
 *
 * readState → buildPlan (pure, a list of ops) → assertPlanScope (refuses anything outside the
 * demo and its fictitious friends) → applyPlan (one `db.batch`, all or nothing). Everything is
 * looked up before it is written, so a second run plans 0 ops. Shared `Catalog` rows are only
 * ever inserted, never updated: other people see them.
 */

export type Friend = Pick<FriendSeed, "id" | "email" | "name" | "role">;

export type PlanConfig = {
  demoUserId: string;
  demoEmail: string;
  friends: Friend[];
};

export const DEFAULT_CONFIG: PlanConfig = { demoUserId: DEMO_USER_ID, demoEmail: DEMO_EMAIL, friends: FRIENDS };

type UserState = { id: string; email: string; streamingPlatforms: unknown };
type CatalogState = { id: string; year: number | null; kind: TitleKind };
type TitleState = {
  id: string;
  catalogId: string;
  rating: number | null;
  review: string | null;
  platform: Platform | null;
  watchedAt: Date | null;
};
type ListState = { id: string; slug: string | null; name: string; kind: ListKind; year: number | null };
type ItemState = { position: number; addedByUserId: string | null };

export type DemoState = {
  users: Map<string, UserState>;
  catalog: Map<string, CatalogState>;
  /** The demo's titles by catalog id. */
  titles: Map<string, TitleState>;
  /** The demo's own lists. */
  lists: ListState[];
  /** listId → catalogId → item, for the demo's lists. */
  items: Map<string, Map<string, ItemState>>;
  /** listId → member userId → role. */
  members: Map<string, Map<string, ListRole>>;
};

type NewTitle = {
  id: string;
  catalogId: string;
  rating: number | null;
  review: string | null;
  platform: Platform | null;
  watchedAt: Date | null;
  seriesStatus: SeriesStatus | null;
  seriesSeason: number | null;
};

export type Op =
  | { op: "insertUser"; userId: string; email: string; name: string }
  | { op: "setPlatforms"; userId: string; platforms: Platform[] }
  | { op: "insertCatalog"; film: DemoFilm & { id: string } }
  | { op: "insertTitle"; userId: string; label: string; row: NewTitle }
  | { op: "updateTitle"; userId: string; label: string; titleId: string; set: Partial<Omit<NewTitle, "id" | "catalogId">> }
  | { op: "insertList"; userId: string; row: { id: string; name: string; description: string; kind: ListKind; slug: string | null; year: number | null } }
  | { op: "insertItem"; listOwnerId: string; listId: string; listName: string; label: string; catalogId: string; addedByUserId: string; position: number; queueNote: string | null }
  | { op: "moveItem"; listOwnerId: string; listId: string; listName: string; label: string; catalogId: string; position: number }
  | { op: "deleteItem"; listOwnerId: string; listId: string; listName: string; label: string; catalogId: string }
  | { op: "insertMember"; listOwnerId: string; listId: string; userId: string; role: ListRole };

export type Plan = { ops: Op[]; warnings: string[] };

const filmKey = (kind: TitleKind, tmdbId: number) => `${kind}:${tmdbId}`;

/** Evening of that October 2026 day in Mexico City (UTC−6, no DST since 2022). */
export const watchedAtFor = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T21:00:00-06:00`);

/** October 2026 in Mexico City, as UTC bounds. */
export const OCTOBER_2026 = { from: new Date("2026-10-01T00:00:00-06:00"), to: new Date("2026-11-01T00:00:00-06:00") };

/** «Tu top 10»: the 2026 films by rating, then by the day they were watched. */
export const topPicks = (films: WatchedSeed[] = WATCHED_2026) =>
  [...films].sort((a, b) => b.rating - a.rating || a.day - b.day).slice(0, YEAR_TOP_SIZE);

export const readState = async (config: PlanConfig = DEFAULT_CONFIG): Promise<DemoState> => {
  const userIds = [config.demoUserId, ...config.friends.map((friend) => friend.id)];
  const films = [...WATCHED, ...QUEUE];
  const tmdbIds = [...new Set(films.map((film) => film.tmdbId))];

  const [userRows, catalogRows, titleRows, listRows] = await Promise.all([
    db
      .select({ id: users.id, email: users.email, streamingPlatforms: users.streamingPlatforms })
      .from(users)
      .where(inArray(users.id, userIds)),
    db
      .select({ id: catalog.id, tmdbId: catalog.tmdbId, kind: catalog.kind, year: catalog.year })
      .from(catalog)
      .where(inArray(catalog.tmdbId, tmdbIds)),
    db
      .select({
        id: titles.id,
        catalogId: titles.catalogId,
        rating: titles.rating,
        review: titles.review,
        platform: titles.platform,
        watchedAt: titles.watchedAt,
      })
      .from(titles)
      .where(eq(titles.userId, config.demoUserId)),
    db
      .select({ id: lists.id, slug: lists.slug, name: lists.name, kind: lists.kind, year: lists.year })
      .from(lists)
      .where(eq(lists.userId, config.demoUserId)),
  ]);

  const listIds = listRows.map((list) => list.id);
  const [itemRows, memberRows] =
    listIds.length > 0
      ? await Promise.all([
          db
            .select({
              listId: listItems.listId,
              catalogId: listItems.catalogId,
              position: listItems.position,
              addedByUserId: listItems.addedByUserId,
            })
            .from(listItems)
            .where(inArray(listItems.listId, listIds)),
          db
            .select({ listId: listMembers.listId, userId: listMembers.userId, role: listMembers.role })
            .from(listMembers)
            .where(inArray(listMembers.listId, listIds)),
        ])
      : [[], []];

  const items = new Map<string, Map<string, ItemState>>();
  for (const row of itemRows) {
    const byCatalog = items.get(row.listId) ?? new Map<string, ItemState>();
    byCatalog.set(row.catalogId, { position: row.position, addedByUserId: row.addedByUserId });
    items.set(row.listId, byCatalog);
  }
  const members = new Map<string, Map<string, ListRole>>();
  for (const row of memberRows) {
    const byUser = members.get(row.listId) ?? new Map<string, ListRole>();
    byUser.set(row.userId, row.role);
    members.set(row.listId, byUser);
  }

  return {
    users: new Map(userRows.map((row) => [row.id, row])),
    catalog: new Map(catalogRows.map((row) => [filmKey(row.kind, row.tmdbId), { id: row.id, year: row.year, kind: row.kind }])),
    titles: new Map(titleRows.map((row) => [row.catalogId, row])),
    lists: listRows,
    items,
    members,
  };
};

const samePlatforms = (current: unknown, wanted: Platform[]) =>
  Array.isArray(current) && current.length === wanted.length && wanted.every((platform) => current.includes(platform));

export const buildPlan = (state: DemoState, config: PlanConfig = DEFAULT_CONFIG): Plan => {
  const ops: Op[] = [];
  const warnings: string[] = [];
  const demoId = config.demoUserId;

  const demo = state.users.get(demoId);
  if (!demo) {
    throw new Error(`No existe el usuario demo ${demoId}. Corre primero npm run db:seed.`);
  }
  if (demo.email !== config.demoEmail) {
    throw new Error(`El usuario ${demoId} no es ${config.demoEmail} (es ${demo.email}).`);
  }

  if (!samePlatforms(demo.streamingPlatforms, DEMO_PLATFORMS)) {
    ops.push({ op: "setPlatforms", userId: demoId, platforms: DEMO_PLATFORMS });
  }

  for (const friend of config.friends) {
    const existing = state.users.get(friend.id);
    if (!existing) {
      ops.push({ op: "insertUser", userId: friend.id, email: friend.email, name: friend.name });
    } else if (existing.email !== friend.email) {
      throw new Error(`El id ${friend.id} ya es de ${existing.email}, no de ${friend.email}.`);
    }
  }

  // Shared catalog: insert what is missing, never touch what exists.
  const catalogIds = new Map<string, string>();
  for (const film of [...WATCHED, ...QUEUE]) {
    const key = filmKey(film.kind, film.tmdbId);
    if (catalogIds.has(key)) continue;
    const existing = state.catalog.get(key);
    if (existing) {
      catalogIds.set(key, existing.id);
      if (existing.year !== film.year) {
        warnings.push(`Catalog ${film.name} (${key}) tiene año ${existing.year ?? "—"}, no ${film.year}; no se toca.`);
      }
    } else {
      const id = catalogIdFor(film.kind, film.tmdbId);
      catalogIds.set(key, id);
      ops.push({ op: "insertCatalog", film: { ...film, id } });
    }
  }
  const catalogIdOf = (film: { kind: TitleKind; tmdbId: number }) => catalogIds.get(filmKey(film.kind, film.tmdbId))!;

  for (const film of WATCHED) {
    const catalogId = catalogIdOf(film);
    const wanted = {
      rating: film.rating,
      watchedAt: watchedAtFor(film.day),
      review: film.review ?? null,
      platform: film.platform ?? null,
    };
    const existing = state.titles.get(catalogId);
    if (!existing) {
      ops.push({
        op: "insertTitle",
        userId: demoId,
        label: film.name,
        row: { id: createId(), catalogId, ...wanted, seriesStatus: null, seriesSeason: null },
      });
      continue;
    }
    const set: Partial<NewTitle> = {};
    if (existing.rating !== wanted.rating) set.rating = wanted.rating;
    if (existing.watchedAt?.getTime() !== wanted.watchedAt.getTime()) set.watchedAt = wanted.watchedAt;
    // Only fill what the demo data says; an existing review or platform stays when the data has none.
    if (wanted.review && existing.review !== wanted.review) set.review = wanted.review;
    if (wanted.platform && existing.platform !== wanted.platform) set.platform = wanted.platform;
    if (Object.keys(set).length > 0) {
      ops.push({ op: "updateTitle", userId: demoId, label: film.name, titleId: existing.id, set });
    }
  }

  const watchlist = state.lists.find((list) => list.slug === WATCHLIST_SLUG);
  if (!watchlist) {
    throw new Error("El demo no tiene «Quiero ver». Corre primero npm run db:seed.");
  }
  const queueItems = state.items.get(watchlist.id) ?? new Map<string, ItemState>();
  let nextPosition = Math.max(-1, ...[...queueItems.values()].map((item) => item.position)) + 1;

  for (const film of QUEUE) {
    const catalogId = catalogIdOf(film);
    const existing = state.titles.get(catalogId);
    if (existing?.watchedAt) {
      warnings.push(`${film.name} ya está vista en el demo; no se agrega a Quiero ver.`);
      continue;
    }
    if (!existing) {
      ops.push({
        op: "insertTitle",
        userId: demoId,
        label: film.name,
        row: {
          id: createId(),
          catalogId,
          rating: null,
          review: null,
          platform: film.platform ?? null,
          watchedAt: null,
          seriesStatus: film.kind === "SERIES" ? (film.seriesStatus ?? null) : null,
          seriesSeason: film.kind === "SERIES" ? (film.seriesSeason ?? null) : null,
        },
      });
    }
    if (!queueItems.has(catalogId)) {
      ops.push({
        op: "insertItem",
        listOwnerId: demoId,
        listId: watchlist.id,
        listName: watchlist.name,
        label: film.name,
        catalogId,
        addedByUserId: demoId,
        position: nextPosition++,
        queueNote: film.queueNote ?? null,
      });
    }
  }
  // Watching a film takes it out of the queue in the app; do the same here.
  for (const film of WATCHED) {
    const catalogId = catalogIdOf(film);
    if (queueItems.has(catalogId)) {
      ops.push({ op: "deleteItem", listOwnerId: demoId, listId: watchlist.id, listName: watchlist.name, label: film.name, catalogId });
    }
  }

  // «Cine con los cuates»: owned by the demo, friends joined directly (no invite, no join request).
  const allFilms = new Map([...WATCHED, ...QUEUE].map((film) => [filmKey(film.kind, film.tmdbId), film]));
  let shared = state.lists.find((list) => list.kind === "COLLECTION" && list.name === SHARED_LIST_NAME);
  if (!shared) {
    shared = { id: createId(), slug: null, name: SHARED_LIST_NAME, kind: "COLLECTION", year: null };
    ops.push({
      op: "insertList",
      userId: demoId,
      row: { id: shared.id, name: SHARED_LIST_NAME, description: SHARED_LIST_DESCRIPTION, kind: "COLLECTION", slug: null, year: null },
    });
  }
  const sharedMembers = state.members.get(shared.id) ?? new Map<string, ListRole>();
  for (const friend of config.friends) {
    if (!sharedMembers.has(friend.id)) {
      ops.push({ op: "insertMember", listOwnerId: demoId, listId: shared.id, userId: friend.id, role: friend.role });
    }
  }
  const sharedItems = state.items.get(shared.id) ?? new Map<string, ItemState>();
  for (const [position, item] of SHARED_ITEMS.entries()) {
    const catalogId = catalogIdOf(item);
    if (sharedItems.has(catalogId)) continue;
    const friendIndex = item.addedBy ? FRIENDS.findIndex((friend) => friend.id === item.addedBy) : -1;
    ops.push({
      op: "insertItem",
      listOwnerId: demoId,
      listId: shared.id,
      listName: shared.name,
      label: allFilms.get(filmKey(item.kind, item.tmdbId))?.name ?? catalogId,
      catalogId,
      // Map the data's friend to the configured one (tests swap ids), else the demo.
      addedByUserId: friendIndex >= 0 ? (config.friends[friendIndex]?.id ?? demoId) : demoId,
      position,
      queueNote: null,
    });
  }

  // «Mi top de 2026», as the /cine sheet saves it (YEAR_TOP, slug top-2026), in rating order.
  const slug = yearTopSlug(TOP_YEAR);
  let top = state.lists.find((list) => list.slug === slug);
  if (top && top.kind !== "YEAR_TOP") {
    throw new Error(`El demo ya tiene una lista «${top.name}» con slug ${slug} que no es un top.`);
  }
  if (!top) {
    top = { id: createId(), slug, name: yearTopName(TOP_YEAR), kind: "YEAR_TOP", year: TOP_YEAR };
    ops.push({
      op: "insertList",
      userId: demoId,
      row: {
        id: top.id,
        name: top.name,
        description: `Mis películas favoritas estrenadas en ${TOP_YEAR}.`,
        kind: "YEAR_TOP",
        slug,
        year: TOP_YEAR,
      },
    });
  }
  const topItems = state.items.get(top.id) ?? new Map<string, ItemState>();
  const picks = topPicks();
  const pickIds = new Set(picks.map((film) => catalogIdOf(film)));
  for (const [catalogId] of topItems) {
    if (!pickIds.has(catalogId)) {
      ops.push({ op: "deleteItem", listOwnerId: demoId, listId: top.id, listName: top.name, label: catalogId, catalogId });
    }
  }
  for (const [position, film] of picks.entries()) {
    const catalogId = catalogIdOf(film);
    const existing = topItems.get(catalogId);
    if (!existing) {
      ops.push({ op: "insertItem", listOwnerId: demoId, listId: top.id, listName: top.name, label: film.name, catalogId, addedByUserId: demoId, position, queueNote: null });
    } else if (existing.position !== position) {
      ops.push({ op: "moveItem", listOwnerId: demoId, listId: top.id, listName: top.name, label: film.name, catalogId, position });
    }
  }

  return { ops, warnings };
};

/**
 * The prod guard: every user an op writes for must be the demo or one of its fictitious
 * friends, every list must be the demo's, and every new account must be on `*.invalid`.
 * Throws before anything is written.
 */
export const assertPlanScope = (ops: Op[], config: PlanConfig = DEFAULT_CONFIG) => {
  const friendIds = new Set(config.friends.map((friend) => friend.id));
  const allowed = new Set([config.demoUserId, ...friendIds]);
  const refuse = (op: Op, why: string) => {
    throw new Error(`Guarda FIL-I38: ${why} (${op.op}). No se escribió nada.`);
  };
  for (const friend of config.friends) {
    if (!friend.email.endsWith(".invalid")) {
      throw new Error(`Guarda FIL-I38: ${friend.email} no termina en .invalid. No se escribió nada.`);
    }
  }
  for (const op of ops) {
    switch (op.op) {
      case "insertUser":
        if (!friendIds.has(op.userId)) refuse(op, `crearía la cuenta ${op.userId}, que no es un amigo ficticio`);
        if (!op.email.endsWith(".invalid")) refuse(op, `${op.email} no termina en .invalid`);
        break;
      case "setPlatforms":
      case "insertTitle":
      case "updateTitle":
      case "insertList":
        if (op.userId !== config.demoUserId) refuse(op, `escribiría datos de ${op.userId}`);
        break;
      case "insertItem":
        if (op.listOwnerId !== config.demoUserId) refuse(op, `tocaría una lista de ${op.listOwnerId}`);
        if (!allowed.has(op.addedByUserId)) refuse(op, `agregaría a nombre de ${op.addedByUserId}`);
        break;
      case "moveItem":
      case "deleteItem":
        if (op.listOwnerId !== config.demoUserId) refuse(op, `tocaría una lista de ${op.listOwnerId}`);
        break;
      case "insertMember":
        if (op.listOwnerId !== config.demoUserId) refuse(op, `tocaría una lista de ${op.listOwnerId}`);
        if (!friendIds.has(op.userId)) refuse(op, `sumaría a ${op.userId}, que no es un amigo ficticio`);
        break;
      case "insertCatalog":
        break;
      default:
        refuse(op, "op desconocida");
    }
  }
};

/** A password nobody knows: the friends can never sign in. */
const unusablePasswordHash = () => hashPassword(randomBytes(32).toString("hex"));

export const applyPlan = async (ops: Op[], config: PlanConfig = DEFAULT_CONFIG) => {
  assertPlanScope(ops, config);
  if (ops.length === 0) return 0;
  const now = new Date();
  const queries = [];
  for (const op of ops) {
    switch (op.op) {
      case "insertUser":
        queries.push(
          db.insert(users).values({
            id: op.userId,
            email: op.email,
            name: op.name,
            passwordHash: await unusablePasswordHash(),
            onboardedAt: now,
            createdAt: now,
          }),
        );
        break;
      case "setPlatforms":
        queries.push(db.update(users).set({ streamingPlatforms: op.platforms }).where(eq(users.id, op.userId)));
        break;
      case "insertCatalog":
        queries.push(
          db
            .insert(catalog)
            .values({
              id: op.film.id,
              tmdbId: op.film.tmdbId,
              kind: op.film.kind,
              name: op.film.name,
              originalName: op.film.originalName ?? null,
              year: op.film.year,
              posterPath: op.film.posterPath,
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoNothing(),
        );
        break;
      case "insertTitle":
        // `Title.updatedAt` has no DB default (Prisma-era column): always set both stamps.
        queries.push(db.insert(titles).values({ ...op.row, userId: op.userId, createdAt: now, updatedAt: now }));
        break;
      case "updateTitle":
        queries.push(
          db
            .update(titles)
            .set({ ...op.set, updatedAt: now })
            .where(and(eq(titles.id, op.titleId), eq(titles.userId, op.userId))),
        );
        break;
      case "insertList":
        queries.push(db.insert(lists).values({ ...op.row, userId: op.userId, createdAt: now, updatedAt: now }));
        break;
      case "insertItem":
        queries.push(
          db.insert(listItems).values({
            listId: op.listId,
            catalogId: op.catalogId,
            addedByUserId: op.addedByUserId,
            position: op.position,
            queueNote: op.queueNote,
            addedAt: now,
          }),
        );
        break;
      case "moveItem":
        queries.push(
          db
            .update(listItems)
            .set({ position: op.position })
            .where(and(eq(listItems.listId, op.listId), eq(listItems.catalogId, op.catalogId))),
        );
        break;
      case "deleteItem":
        queries.push(db.delete(listItems).where(and(eq(listItems.listId, op.listId), eq(listItems.catalogId, op.catalogId))));
        break;
      case "insertMember":
        queries.push(db.insert(listMembers).values({ listId: op.listId, userId: op.userId, role: op.role, joinedAt: now }));
        break;
    }
  }
  await db.batch(queries as unknown as Parameters<typeof db.batch>[0]);
  return ops.length;
};

export const describeOp = (op: Op) => {
  switch (op.op) {
    case "insertUser":
      return `+ cuenta ficticia ${op.name} <${op.email}>`;
    case "setPlatforms":
      return `~ plataformas del demo → ${op.platforms.join(", ")}`;
    case "insertCatalog":
      return `+ Catalog ${op.film.name} (${op.film.year}, TMDB ${op.film.tmdbId})`;
    case "insertTitle":
      return `+ título ${op.label}${op.row.watchedAt ? ` · visto ${op.row.watchedAt.toISOString().slice(0, 10)} · ${op.row.rating}/10` : " · sin ver"}`;
    case "updateTitle":
      return `~ título ${op.label}: ${Object.keys(op.set).join(", ")}`;
    case "insertList":
      return `+ lista «${op.row.name}» (${op.row.kind})`;
    case "insertItem":
      return `+ «${op.listName}» #${op.position} ${op.label}`;
    case "moveItem":
      return `~ «${op.listName}» ${op.label} → #${op.position}`;
    case "deleteItem":
      return `- «${op.listName}» ${op.label}`;
    case "insertMember":
      return `+ miembro ${op.userId} (${op.role})`;
  }
};

export type TutorialCounts = {
  watchedInOctober: number;
  quieroVer: number;
  watchedRated2026: number;
  yearTopItems: number;
  platforms: number;
  sharedMembers: number;
  sharedMembersInvalid: number;
  /** Invites, join requests and push subscriptions that involve the fictitious friends. */
  friendSideRows: number;
};

export const readCounts = async (config: PlanConfig = DEFAULT_CONFIG): Promise<TutorialCounts> => {
  const demoId = config.demoUserId;
  const friendIds = config.friends.map((friend) => friend.id);
  const one = <T extends { value: number }>(rows: T[]) => Number(rows[0]?.value ?? 0);

  const [demo] = await db.select({ platforms: users.streamingPlatforms }).from(users).where(eq(users.id, demoId));
  const demoLists = await db
    .select({ id: lists.id, slug: lists.slug, kind: lists.kind, name: lists.name, year: lists.year })
    .from(lists)
    .where(eq(lists.userId, demoId));
  const watchlist = demoLists.find((list) => list.slug === WATCHLIST_SLUG);
  const top = demoLists.find((list) => list.kind === "YEAR_TOP" && list.year === TOP_YEAR);
  const shared = demoLists.find((list) => list.kind === "COLLECTION" && list.name === SHARED_LIST_NAME);

  const [watchedInOctober, quieroVer, watchedRated2026, yearTopItems, members, invites, requests, pushes] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(titles)
        .where(and(eq(titles.userId, demoId), gte(titles.watchedAt, OCTOBER_2026.from), lt(titles.watchedAt, OCTOBER_2026.to)))
        .then(one),
      watchlist
        ? db.select({ value: count() }).from(listItems).where(eq(listItems.listId, watchlist.id)).then(one)
        : 0,
      db
        .select({ value: count() })
        .from(titles)
        .innerJoin(catalog, eq(catalog.id, titles.catalogId))
        .where(
          and(
            eq(titles.userId, demoId),
            isNotNull(titles.watchedAt),
            isNotNull(titles.rating),
            eq(catalog.year, TOP_YEAR),
            eq(catalog.kind, "MOVIE"),
          ),
        )
        .then(one),
      top ? db.select({ value: count() }).from(listItems).where(eq(listItems.listId, top.id)).then(one) : 0,
      shared
        ? db
            .select({ email: users.email })
            .from(listMembers)
            .innerJoin(users, eq(users.id, listMembers.userId))
            .where(eq(listMembers.listId, shared.id))
        : [],
      friendIds.length > 0
        ? db.select({ value: count() }).from(listInvites).where(inArray(listInvites.createdByUserId, friendIds)).then(one)
        : 0,
      friendIds.length > 0
        ? db.select({ value: count() }).from(listJoinRequests).where(inArray(listJoinRequests.userId, friendIds)).then(one)
        : 0,
      friendIds.length > 0
        ? db.select({ value: count() }).from(pushSubscriptions).where(inArray(pushSubscriptions.userId, friendIds)).then(one)
        : 0,
    ]);

  return {
    watchedInOctober,
    quieroVer,
    watchedRated2026,
    yearTopItems,
    platforms: Array.isArray(demo?.platforms) ? demo.platforms.length : 0,
    sharedMembers: members.length,
    sharedMembersInvalid: members.filter((member) => member.email.endsWith(".invalid")).length,
    friendSideRows: invites + requests + pushes,
  };
};

/** What the video needs; each failure is one line. Empty = ready to record. */
export const checkCounts = (counts: TutorialCounts) => {
  const failures: string[] = [];
  if (counts.watchedInOctober < 30) failures.push(`Vistos en octubre 2026: ${counts.watchedInOctober} (< 30)`);
  if (counts.quieroVer < 30) failures.push(`Quiero ver: ${counts.quieroVer} (< 30)`);
  if (counts.watchedRated2026 < YEAR_TOP_SIZE) {
    failures.push(`Películas de ${TOP_YEAR} vistas y calificadas: ${counts.watchedRated2026} (< ${YEAR_TOP_SIZE})`);
  }
  if (counts.yearTopItems !== YEAR_TOP_SIZE) failures.push(`«Mi top de ${TOP_YEAR}»: ${counts.yearTopItems} (≠ ${YEAR_TOP_SIZE})`);
  if (counts.platforms < 1) failures.push("El demo no tiene plataformas");
  if (counts.sharedMembers < 3) failures.push(`«${SHARED_LIST_NAME}»: ${counts.sharedMembers} miembros (< 3)`);
  if (counts.sharedMembersInvalid !== counts.sharedMembers) {
    failures.push(`«${SHARED_LIST_NAME}»: ${counts.sharedMembers - counts.sharedMembersInvalid} miembros fuera de .invalid`);
  }
  if (counts.friendSideRows !== 0) failures.push(`Invitaciones/solicitudes/push de amigos ficticios: ${counts.friendSideRows} (≠ 0)`);
  return failures;
};
