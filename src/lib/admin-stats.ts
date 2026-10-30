import { count, desc, eq, gte, isNull, notInArray, or, sql } from "drizzle-orm";
import { apiUsage, db, lists, titles, users } from "@/db";
import { utcDay, type ApiProvider } from "@/lib/api-usage";
import { FIXED_LIST_SLUGS } from "@/lib/lists";

/** OMDb free tier (FIL-I36): 1 000 requests per UTC day, then 401. TMDB has no daily quota. */
export const OMDB_DAILY_LIMIT = 1000;

/** «Gustados»: 4 stars or more. `Title.rating` is stored 1–10, two points per star. */
export const LIKED_MIN_RATING = 8;

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  /** null when never seen, or when 0025 is not applied yet (`lastActiveMissing`). */
  lastActiveAt: Date | null;
  titles: number;
  watched: number;
  liked: number;
  lists: number;
};

export type AdminUsers = { rows: AdminUserRow[]; lastActiveMissing: boolean };

/** Most recent activity first; never-seen accounts last, newest sign-up first among them. */
export const sortAdminUsers = (rows: AdminUserRow[]) =>
  [...rows].sort(
    (a, b) =>
      (b.lastActiveAt?.getTime() ?? -Infinity) - (a.lastActiveAt?.getTime() ?? -Infinity) ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );

const queryUsers = async (withLastActive: boolean) => {
  const titleCounts = db
    .select({
      userId: titles.userId,
      titles: count().as("titles"),
      watched: count(titles.watchedAt).as("watched"),
      liked: sql<number>`count(*) filter (where ${titles.rating} >= ${LIKED_MIN_RATING})`.mapWith(Number).as("liked"),
    })
    .from(titles)
    .groupBy(titles.userId)
    .as("title_counts");
  // The five fixed lists every account gets (Quiero ver, Favoritas…) are not «lists they made».
  const listCounts = db
    .select({ userId: lists.userId, lists: count().as("lists") })
    .from(lists)
    .where(or(isNull(lists.slug), notInArray(lists.slug, [...FIXED_LIST_SLUGS])))
    .groupBy(lists.userId)
    .as("list_counts");

  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      lastActiveAt: withLastActive ? users.lastActiveAt : sql<Date | null>`null`,
      titles: sql<number>`coalesce(${titleCounts.titles}, 0)`.mapWith(Number),
      watched: sql<number>`coalesce(${titleCounts.watched}, 0)`.mapWith(Number),
      liked: sql<number>`coalesce(${titleCounts.liked}, 0)`.mapWith(Number),
      lists: sql<number>`coalesce(${listCounts.lists}, 0)`.mapWith(Number),
    })
    .from(users)
    .leftJoin(titleCounts, eq(titleCounts.userId, users.id))
    .leftJoin(listCounts, eq(listCounts.userId, users.id))
    .orderBy(desc(users.createdAt));
};

/** Every account with its counts. Before 0025 the column is missing: retried without it. */
export const loadAdminUsers = async (): Promise<AdminUsers> => {
  try {
    return { rows: sortAdminUsers(await queryUsers(true)), lastActiveMissing: false };
  } catch {
    return { rows: sortAdminUsers(await queryUsers(false)), lastActiveMissing: true };
  }
};

export type ApiUsageDay = { day: string; omdb: number; tmdb: number };

/** The last `days` UTC days, today first, zeros where nothing was called. */
export const fillUsageDays = (
  rows: { provider: string; day: string; count: number }[],
  now: Date,
  days = 7,
): ApiUsageDay[] => {
  const byKey = new Map(rows.map((row) => [`${row.provider}:${row.day}`, row.count]));
  return Array.from({ length: days }, (_, index) => {
    const day = utcDay(new Date(now.getTime() - index * 24 * 60 * 60 * 1000));
    const at = (provider: ApiProvider) => byKey.get(`${provider}:${day}`) ?? 0;
    return { day, omdb: at("omdb"), tmdb: at("tmdb") };
  });
};

/** null when `ApiUsage` does not exist yet (before 0026) or cannot be read. */
export const loadApiUsage = async (now: Date = new Date(), days = 7): Promise<ApiUsageDay[] | null> => {
  const since = utcDay(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000));
  try {
    const rows = await db
      .select({ provider: apiUsage.provider, day: apiUsage.day, count: apiUsage.count })
      .from(apiUsage)
      .where(gte(apiUsage.day, since));
    return fillUsageDays(rows, now, days);
  } catch {
    return null;
  }
};

export type QuotaTone = "ok" | "warn" | "danger";

/** Green under 70 %, amber 70–90 %, red over 90 % (Design doc). */
export const quotaTone = (used: number, limit = OMDB_DAILY_LIMIT): QuotaTone => {
  const share = used / limit;
  if (share > 0.9) return "danger";
  if (share >= 0.7) return "warn";
  return "ok";
};
