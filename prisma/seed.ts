import { config as loadEnv } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";

loadEnv({ path: ".env.local" });
loadEnv();
import {
  ListKind,
  Platform,
  PrismaClient,
  TitleKind,
} from "../src/generated/prisma/client";
import { slugify } from "../src/lib/labels";
import {
  WATCHLIST_DESCRIPTION,
  WATCHLIST_NAME,
  WATCHLIST_SLUG,
} from "../src/lib/watchlist";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida.");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

type SeedTitle = {
  name: string;
  originalName?: string;
  kind: TitleKind;
  year: number;
  rating?: number;
  review?: string;
  platform?: Platform;
  tags: string[];
  lists: string[];
  watched?: boolean;
  tmdbId: number;
  posterPath: string;
};

type WatchlistSeed = {
  name: string;
  year: number;
  kind: TitleKind;
  platform?: Platform;
  queueNote: string;
  position: number;
  tmdbId: number;
  posterPath: string;
};

const seedTitles: SeedTitle[] = [
  {
    name: "Gladiator",
    kind: TitleKind.MOVIE,
    year: 2000,
    rating: 9,
    review: "Épica de arena y honor. Seed de gusto, no un diario personal.",
    platform: Platform.PRIME,
    tags: ["épico", "histórico"],
    lists: ["Épicas"],
    watched: true,
    tmdbId: 98,
    posterPath: "/wN2xWp1eIwCKOD0BHTcErTBv1Uq.jpg",
  },
  {
    name: "Troy",
    kind: TitleKind.MOVIE,
    year: 2004,
    rating: 7,
    review: "Homero con bloquebuster: bronce, playa y discurso.",
    platform: Platform.MAX,
    tags: ["épico", "histórico"],
    lists: ["Épicas"],
    watched: true,
    tmdbId: 652,
    posterPath: "/a07wLy4ONfpsjnBqMwhlWTJTcm.jpg",
  },
  {
    name: "Athena",
    kind: TitleKind.MOVIE,
    year: 2022,
    rating: 8,
    review: "Romain Gavras. Tensión urbana en un solo aliento.",
    platform: Platform.NETFLIX,
    tags: ["thriller", "francés"],
    lists: ["Visto recientemente"],
    watched: true,
    tmdbId: 812425,
    posterPath: "/5b2b30WtaLS8nyuRY8I3DN5hAxb.jpg",
  },
  {
    name: "The Northman",
    kind: TitleKind.MOVIE,
    year: 2022,
    rating: 8,
    review: "Venganza nórdica, barro y mito.",
    platform: Platform.PRIME,
    tags: ["épico", "histórico"],
    lists: ["Épicas"],
    watched: true,
    tmdbId: 639933,
    posterPath: "/aSSJMnHknzKjlZ6zybwD7eyJ4Po.jpg",
  },
  {
    name: "Mad Max: Fury Road",
    kind: TitleKind.MOVIE,
    year: 2015,
    rating: 10,
    review: "Vibe desierto/cromo. Persecución absoluta.",
    platform: Platform.MAX,
    tags: ["acción", "vibe-mad-max"],
    lists: ["Vibe Mad Max / Tron"],
    watched: true,
    tmdbId: 76341,
    posterPath: "/ulcAi4dKpAjHwYGS08vNyx9H6I9.jpg",
  },
  {
    name: "Tron: Legacy",
    kind: TitleKind.MOVIE,
    year: 2010,
    rating: 7,
    review: "Neón, grid y soundtrack. Vibe Tron.",
    platform: Platform.DISNEY,
    tags: ["sci-fi", "vibe-tron"],
    lists: ["Vibe Mad Max / Tron"],
    watched: true,
    tmdbId: 20526,
    posterPath: "/8Nc6R8k7bG8frSiDJo0oLucF7dN.jpg",
  },
  {
    name: "Dune: Part Two",
    originalName: "Dune: Part Two",
    kind: TitleKind.MOVIE,
    year: 2024,
    rating: 9,
    review: "Arena, política y mesías. Dummy seed.",
    platform: Platform.MAX,
    tags: ["sci-fi", "épico"],
    lists: ["Épicas", "Visto recientemente"],
    watched: true,
    tmdbId: 693134,
    posterPath: "/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg",
  },
];

const watchlistQueue: WatchlistSeed[] = [
  {
    name: "Blade Runner 2049",
    year: 2017,
    kind: TitleKind.MOVIE,
    platform: Platform.NETFLIX,
    queueNote: "Revisar la fotografía otra vez.",
    position: 0,
    tmdbId: 335984,
    posterPath: "/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg",
  },
  {
    name: "Interstellar",
    year: 2014,
    kind: TitleKind.MOVIE,
    platform: Platform.PRIME,
    queueNote: "Para un domingo largo.",
    position: 1,
    tmdbId: 157336,
    posterPath: "/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg",
  },
  {
    name: "Severance",
    year: 2022,
    kind: TitleKind.SERIES,
    platform: Platform.MAX,
    queueNote: "Temporada 2 pendiente.",
    position: 2,
    tmdbId: 95396,
    posterPath: "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
  },
];

const listDescriptions: Record<string, string> = {
  Épicas: "Espadas, arena y discursos largos.",
  "Visto recientemente": "Cola corta de lo último en el seed.",
  "Vibe Mad Max / Tron": "Cromo, desierto, grid y neón.",
};

const upsertTag = async (name: string) => {
  const slug = slugify(name);
  return prisma.tag.upsert({
    where: { slug },
    update: { name },
    create: { name, slug },
  });
};

const upsertCollection = async (name: string) => {
  const existing = await prisma.list.findFirst({
    where: { name, kind: ListKind.COLLECTION },
  });
  if (existing) {
    return existing;
  }

  return prisma.list.create({
    data: {
      name,
      description: listDescriptions[name],
      kind: ListKind.COLLECTION,
    },
  });
};

const ensureWatchlist = async () =>
  prisma.list.upsert({
    where: { slug: WATCHLIST_SLUG },
    update: {
      name: WATCHLIST_NAME,
      description: WATCHLIST_DESCRIPTION,
      kind: ListKind.WATCHLIST,
    },
    create: {
      slug: WATCHLIST_SLUG,
      name: WATCHLIST_NAME,
      description: WATCHLIST_DESCRIPTION,
      kind: ListKind.WATCHLIST,
    },
  });

const seed = async () => {
  const tagRecords = new Map<string, { id: string }>();
  const listRecords = new Map<string, { id: string }>();

  const uniqueTags = [...new Set(seedTitles.flatMap((title) => title.tags))];
  const uniqueLists = [...new Set(seedTitles.flatMap((title) => title.lists))];

  for (const tagName of uniqueTags) {
    tagRecords.set(tagName, await upsertTag(tagName));
  }

  for (const listName of uniqueLists) {
    listRecords.set(listName, await upsertCollection(listName));
  }

  const watchlist = await ensureWatchlist();

  for (const [index, title] of seedTitles.entries()) {
    const existing = await prisma.title.findFirst({
      where: { name: title.name, year: title.year },
    });

    const data = {
      name: title.name,
      originalName: title.originalName,
      kind: title.kind,
      year: title.year,
      rating: title.rating ?? null,
      review: title.review ?? null,
      platform: title.platform ?? null,
      tmdbId: title.tmdbId,
      posterPath: title.posterPath,
      watchedAt: title.watched
        ? new Date(`${title.year}-06-15T12:00:00.000Z`)
        : null,
    };

    const saved = existing
      ? await prisma.title.update({ where: { id: existing.id }, data })
      : await prisma.title.create({ data });

    await prisma.titleTag.deleteMany({ where: { titleId: saved.id } });
    await prisma.titleTag.createMany({
      data: title.tags.map((tagName) => ({
        titleId: saved.id,
        tagId: tagRecords.get(tagName)!.id,
      })),
    });

    for (const listName of title.lists) {
      await prisma.listItem.upsert({
        where: {
          listId_titleId: {
            listId: listRecords.get(listName)!.id,
            titleId: saved.id,
          },
        },
        update: { position: index },
        create: {
          listId: listRecords.get(listName)!.id,
          titleId: saved.id,
          position: index,
        },
      });
    }
  }

  for (const item of watchlistQueue) {
    const existing = await prisma.title.findFirst({
      where: { name: item.name, year: item.year },
    });

    const saved = existing
      ? await prisma.title.update({
          where: { id: existing.id },
          data: {
            kind: item.kind,
            platform: item.platform ?? null,
            watchedAt: null,
            rating: null,
            tmdbId: item.tmdbId,
            posterPath: item.posterPath,
          },
        })
      : await prisma.title.create({
          data: {
            name: item.name,
            kind: item.kind,
            year: item.year,
            platform: item.platform ?? null,
            tmdbId: item.tmdbId,
            posterPath: item.posterPath,
          },
        });

    await prisma.listItem.upsert({
      where: {
        listId_titleId: { listId: watchlist.id, titleId: saved.id },
      },
      update: {
        position: item.position,
        queueNote: item.queueNote,
      },
      create: {
        listId: watchlist.id,
        titleId: saved.id,
        position: item.position,
        queueNote: item.queueNote,
      },
    });
  }

  console.log(
    `Seed listo: ${seedTitles.length} títulos vistos, ${watchlistQueue.length} en watchlist.`,
  );
};

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
