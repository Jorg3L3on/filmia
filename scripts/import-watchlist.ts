import { config as loadEnv } from "dotenv";
import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

import {
  db,
  listItems,
  lists,
  titles,
  type Platform,
  type TitleKind,
} from "../src/db/index";
import {
  WATCHLIST_DESCRIPTION,
  WATCHLIST_NAME,
  WATCHLIST_SLUG,
} from "../src/lib/watchlist";

const DEMO_USER_ID = "cm4demofilmia00000000001";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida.");
}

type QueueFilm = {
  name: string;
  originalName?: string;
  year: number;
  imdbRating?: number;
  platform?: Platform;
  kind?: TitleKind;
  search?: string;
};

type WikiSearchResponse = {
  query?: { search?: Array<{ title: string }> };
};

type WikiSummaryResponse = {
  originalimage?: { source?: string };
  thumbnail?: { source?: string };
};

const WIKI_USER_AGENT =
  "FilmiaWatchlistImport/1.0 (https://github.com/Jorg3L3on/filmia; local catalog import)";

const isPlatform = (value: unknown): value is Platform =>
  value === "NETFLIX" ||
  value === "PRIME" ||
  value === "MAX" ||
  value === "DISNEY" ||
  value === "CLARO" ||
  value === "APPLE" ||
  value === "MUBI" ||
  value === "PARAMOUNT" ||
  value === "CRUNCHYROLL" ||
  value === "VIX" ||
  value === "PLUTO" ||
  value === "AMCPLUS" ||
  value === "CURIOSITY" ||
  value === "LIONSGATE";

const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const wikiJson = async <T>(url: string): Promise<T | null> => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": WIKI_USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
};

const cleanImageUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    if (parsed.pathname.toLowerCase().endsWith(".svg")) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const lookupPoster = async (film: QueueFilm) => {
  const kindHint = film.kind === "SERIES" ? "television series" : "film";
  const queries = [
    `${film.search ?? ""} ${kindHint}`.trim(),
    `${film.originalName ?? film.name} (${film.year} ${kindHint})`,
    `${film.originalName ?? film.name} ${film.year}`,
    film.name,
  ].filter((query, index, all) => query && all.indexOf(query) === index);

  for (const lang of ["en", "es"] as const) {
    for (const query of queries) {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({
        action: "query",
        list: "search",
        srsearch: query,
        srlimit: "1",
        format: "json",
      }).toString()}`;
      const search = await wikiJson<WikiSearchResponse>(searchUrl);
      const title = search?.query?.search?.[0]?.title;
      await sleep(40);
      if (!title) {
        continue;
      }

      const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const summary = await wikiJson<WikiSummaryResponse>(summaryUrl);
      const source = summary?.originalimage?.source ?? summary?.thumbnail?.source;
      const posterPath = source ? cleanImageUrl(source) : null;
      if (posterPath) {
        return posterPath;
      }
    }
  }

  return null;
};

const ensureWatchlist = async () => {
  const existing = await db.query.lists.findFirst({
    where: and(eq(lists.userId, DEMO_USER_ID), eq(lists.slug, WATCHLIST_SLUG)),
  });

  if (existing) {
    await db
      .update(lists)
      .set({
        name: WATCHLIST_NAME,
        description: WATCHLIST_DESCRIPTION,
        kind: "WATCHLIST",
      })
      .where(eq(lists.id, existing.id));
    return existing;
  }

  const listId = createId();
  await db.insert(lists).values({
    id: listId,
    userId: DEMO_USER_ID,
    slug: WATCHLIST_SLUG,
    name: WATCHLIST_NAME,
    description: WATCHLIST_DESCRIPTION,
    kind: "WATCHLIST",
  });

  const created = await db.query.lists.findFirst({ where: eq(lists.id, listId) });
  if (!created) {
    throw new Error("No se pudo crear Quiero ver.");
  }
  return created;
};

const importQueue = async () => {
  const filePath = resolve(process.cwd(), "scripts/data/watchlist-queue.json");
  const films = JSON.parse(readFileSync(filePath, "utf8")) as QueueFilm[];

  const watchlist = await ensureWatchlist();

  const last = await db.query.listItems.findFirst({
    where: eq(listItems.listId, watchlist.id),
    orderBy: [desc(listItems.position)],
  });

  let position = (last?.position ?? -1) + 1;
  let created = 0;
  let queued = 0;
  let posters = 0;

  for (const film of films) {
    const existing = await db.query.titles.findFirst({
      where: and(eq(titles.userId, DEMO_USER_ID), eq(titles.name, film.name), eq(titles.year, film.year)),
    });

    const posterPath = existing?.posterPath ? existing.posterPath : await lookupPoster(film);

    if (!existing?.posterPath) {
      await sleep(40);
    }

    const kind: TitleKind = film.kind === "SERIES" ? "SERIES" : "MOVIE";
    const platform = isPlatform(film.platform) ? film.platform : (existing?.platform ?? null);

    let savedId = existing?.id;
    if (existing) {
      await db
        .update(titles)
        .set({
          originalName: film.originalName ?? existing.originalName ?? null,
          platform,
          imdbRating: film.imdbRating ?? existing.imdbRating ?? null,
          posterPath,
        })
        .where(eq(titles.id, existing.id));
    } else {
      savedId = createId();
      await db.insert(titles).values({
        id: savedId,
        userId: DEMO_USER_ID,
        name: film.name,
        originalName: film.originalName ?? null,
        kind,
        year: film.year,
        platform,
        imdbRating: film.imdbRating ?? null,
        tmdbId: null,
        posterPath,
        watchedAt: null,
      });
      created += 1;
    }

    const titleId = savedId!;
    if (posterPath) {
      posters += 1;
    }

    const membership = await db.query.listItems.findFirst({
      where: and(eq(listItems.listId, watchlist.id), eq(listItems.titleId, titleId)),
    });

    if (!membership) {
      await db.insert(listItems).values({
        listId: watchlist.id,
        titleId,
        position,
      });
      position += 1;
      queued += 1;
    }

    console.log(
      `${membership ? "·" : "+"} ${film.name} (${film.year})${posterPath ? "" : " [sin poster]"}`,
    );
  }

  console.log(
    `\nImport listo: ${created} títulos nuevos, ${queued} agregados a Quiero ver, ${posters}/${films.length} con poster.`,
  );
};

importQueue().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
