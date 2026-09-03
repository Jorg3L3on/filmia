import { config as loadEnv } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ListKind,
  Platform,
  PrismaClient,
  TitleKind,
} from "../src/generated/prisma/client";
import {
  WATCHLIST_DESCRIPTION,
  WATCHLIST_NAME,
  WATCHLIST_SLUG,
} from "../src/lib/watchlist";

const DEMO_USER_ID = "cm4demofilmia00000000001";

loadEnv({ path: ".env.local" });
loadEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida.");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

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
  value === "MUBI";

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

const importQueue = async () => {
  const filePath = resolve(process.cwd(), "prisma/data/watchlist-queue.json");
  const films = JSON.parse(readFileSync(filePath, "utf8")) as QueueFilm[];

  const watchlist = await prisma.list.upsert({
    where: { userId_slug: { userId: DEMO_USER_ID, slug: WATCHLIST_SLUG } },
    update: {
      name: WATCHLIST_NAME,
      description: WATCHLIST_DESCRIPTION,
      kind: ListKind.WATCHLIST,
    },
    create: {
      userId: DEMO_USER_ID,
      slug: WATCHLIST_SLUG,
      name: WATCHLIST_NAME,
      description: WATCHLIST_DESCRIPTION,
      kind: ListKind.WATCHLIST,
    },
  });

  const last = await prisma.listItem.findFirst({
    where: { listId: watchlist.id },
    orderBy: { position: "desc" },
  });

  let position = (last?.position ?? -1) + 1;
  let created = 0;
  let queued = 0;
  let posters = 0;

  for (const film of films) {
    const existing = await prisma.title.findFirst({
      where: { userId: DEMO_USER_ID, name: film.name, year: film.year },
    });

    const posterPath = existing?.posterPath
      ? existing.posterPath
      : await lookupPoster(film);

    if (!existing?.posterPath) {
      await sleep(40);
    }

    const data = {
      userId: DEMO_USER_ID,
      name: film.name,
      originalName: film.originalName ?? existing?.originalName ?? null,
      kind: film.kind === "SERIES" ? TitleKind.SERIES : TitleKind.MOVIE,
      year: film.year,
      platform: isPlatform(film.platform) ? film.platform : existing?.platform ?? null,
      imdbRating: film.imdbRating ?? existing?.imdbRating ?? null,
      tmdbId: existing?.tmdbId ?? null,
      posterPath,
      watchedAt: existing?.watchedAt ?? null,
    };

    const saved = existing
      ? await prisma.title.update({
          where: { id: existing.id },
          data: {
            originalName: data.originalName,
            platform: data.platform,
            imdbRating: data.imdbRating,
            posterPath: data.posterPath,
          },
        })
      : await prisma.title.create({ data });

    if (!existing) {
      created += 1;
    }
    if (data.posterPath) {
      posters += 1;
    }

    const membership = await prisma.listItem.findUnique({
      where: {
        listId_titleId: { listId: watchlist.id, titleId: saved.id },
      },
    });

    if (!membership) {
      await prisma.listItem.create({
        data: {
          listId: watchlist.id,
          titleId: saved.id,
          position,
        },
      });
      position += 1;
      queued += 1;
    }

    console.log(
      `${membership ? "·" : "+"} ${film.name} (${film.year})${data.posterPath ? "" : " [sin poster]"}`,
    );
  }

  console.log(
    `\nImport listo: ${created} títulos nuevos, ${queued} agregados a Por ver, ${posters}/${films.length} con poster.`,
  );
};

importQueue()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
