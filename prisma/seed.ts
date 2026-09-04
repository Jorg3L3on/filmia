import { config as loadEnv } from "dotenv";
import { hash } from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";

loadEnv({ path: ".env.local" });
loadEnv();
import {
  ListKind,
  Platform,
  PrismaClient,
  SeriesStatus,
  TitleKind,
} from "../src/generated/prisma/client";
import { slugify } from "../src/lib/labels";
import { DEFAULT_LISTS, WATCHLIST_SLUG } from "../src/lib/lists";
import { DEFAULT_TAG_NAMES } from "../src/lib/tags";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida.");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const DEMO_USER_ID = "cm4demofilmia00000000001";
const DEMO_EMAIL = "demo@filmia.local";
const DEMO_PASSWORD = "filmia-demo";

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
  seriesStatus?: SeriesStatus;
  seriesSeason?: number;
  tmdbId: number;
  posterPath: string;
};

type SeedGenre = {
  id: number;
  name: string;
};

type SeedWatchProviders = {
  link: string | null;
  flatrate: Array<{
    providerId: number;
    name: string;
    logoPath: string | null;
    logoUrl: string | null;
  }>;
  rent: [];
  buy: [];
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
  seriesStatus?: SeriesStatus;
  seriesSeason?: number;
  imdbRating?: number;
  tmdbGenres?: SeedGenre[];
  watchProvidersMx?: SeedWatchProviders;
};

const netflixMx: SeedWatchProviders = {
  link: null,
  flatrate: [{ providerId: 8, name: "Netflix", logoPath: null, logoUrl: null }],
  rent: [],
  buy: [],
};

const primeMx: SeedWatchProviders = {
  link: null,
  flatrate: [
    { providerId: 119, name: "Amazon Prime Video", logoPath: null, logoUrl: null },
  ],
  rent: [],
  buy: [],
};

const maxMx: SeedWatchProviders = {
  link: null,
  flatrate: [{ providerId: 1899, name: "Max", logoPath: null, logoUrl: null }],
  rent: [],
  buy: [],
};

const seedTitles: SeedTitle[] = [
  {
    name: "Gladiator",
    kind: TitleKind.MOVIE,
    year: 2000,
    rating: 9,
    review: "Épica de arena y honor. Seed de gusto, no un diario personal.",
    platform: Platform.PRIME,
    tags: ["Épica / guerra", "Histórico"],
    lists: ["Épicas", "Favoritas"],
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
    tags: ["Épica / guerra", "Histórico"],
    lists: ["Épicas"],
    watched: true,
    tmdbId: 652,
    posterPath: "/a07wLy4ONfpsjnBqMwhlWTJTcm.jpg",
  },
  {
    name: "Athena",
    originalName: "Athena",
    kind: TitleKind.MOVIE,
    year: 2022,
    rating: 8,
    review: "Romain Gavras. Tensión urbana en un solo aliento.",
    platform: Platform.NETFLIX,
    tags: ["Thriller", "francés"],
    lists: ["Visto recientemente"],
    watched: true,
    tmdbId: 852046,
    posterPath: "/posters/athena-2022.png",
  },
  {
    name: "The Northman",
    kind: TitleKind.MOVIE,
    year: 2022,
    rating: 8,
    review: "Venganza nórdica, barro y mito.",
    platform: Platform.PRIME,
    tags: ["Épica / guerra", "Histórico"],
    lists: ["Épicas", "Favoritas"],
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
    tags: ["Visual / espectáculo", "Vibe Mad Max"],
    lists: ["Vibe Mad Max / Tron", "Por rewatch"],
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
    tags: ["Sci-fi", "Visual / espectáculo", "Vibe Tron"],
    lists: ["Vibe Mad Max / Tron", "Por rewatch"],
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
    tags: ["Sci-fi", "Épica / guerra", "Visual / espectáculo"],
    lists: ["Épicas", "Visto recientemente", "Favoritas"],
    watched: true,
    tmdbId: 693134,
    posterPath: "/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg",
  },
  {
    name: "Breaking Bad",
    kind: TitleKind.SERIES,
    year: 2008,
    rating: 10,
    review: "Canon. Terminada, sin checklist de episodios.",
    platform: Platform.NETFLIX,
    tags: ["Thriller"],
    lists: ["Favoritas"],
    watched: true,
    seriesStatus: SeriesStatus.FINISHED,
    tmdbId: 1396,
    posterPath: "/ztkUQFLlC19CCMYHW9o1zWhT7eW.jpg",
  },
  {
    name: "The Last of Us",
    kind: TitleKind.SERIES,
    year: 2023,
    rating: 9,
    review: "Viendo. Temporada actual, sin progreso por capítulo.",
    platform: Platform.MAX,
    tags: ["Thriller"],
    lists: ["Visto recientemente"],
    watched: true,
    seriesStatus: SeriesStatus.WATCHING,
    seriesSeason: 2,
    tmdbId: 100088,
    posterPath: "/dmo6TYjN9W6FbdC8pQO3nWKmGvl.jpg",
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
    imdbRating: 8.0,
    tmdbGenres: [
      { id: 878, name: "Ciencia ficción" },
      { id: 18, name: "Drama" },
    ],
    watchProvidersMx: netflixMx,
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
    imdbRating: 8.7,
    tmdbGenres: [
      { id: 12, name: "Aventura" },
      { id: 18, name: "Drama" },
      { id: 878, name: "Ciencia ficción" },
    ],
    watchProvidersMx: primeMx,
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
    seriesStatus: SeriesStatus.WATCHING,
    seriesSeason: 2,
    imdbRating: 8.7,
    tmdbGenres: [
      { id: 18, name: "Drama" },
      { id: 9648, name: "Misterio" },
    ],
    watchProvidersMx: maxMx,
  },
  {
    name: "The Dark Knight",
    year: 2008,
    kind: TitleKind.MOVIE,
    platform: Platform.MAX,
    queueNote: "Nolan otra vez.",
    position: 3,
    tmdbId: 155,
    posterPath: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    imdbRating: 9.0,
    tmdbGenres: [
      { id: 28, name: "Acción" },
      { id: 80, name: "Crimen" },
      { id: 18, name: "Drama" },
    ],
    watchProvidersMx: maxMx,
  },
  {
    name: "Superbad",
    year: 2007,
    kind: TitleKind.MOVIE,
    platform: Platform.NETFLIX,
    queueNote: "Comedia rápida.",
    position: 4,
    tmdbId: 8363,
    posterPath: "/ek8e8d58kcOZhSxWOsZHCJ9Ym2w.jpg",
    imdbRating: 7.6,
    tmdbGenres: [{ id: 35, name: "Comedia" }],
    watchProvidersMx: netflixMx,
  },
  {
    name: "John Wick",
    year: 2014,
    kind: TitleKind.MOVIE,
    platform: Platform.NETFLIX,
    queueNote: "Acción limpia.",
    position: 5,
    tmdbId: 245891,
    posterPath: "/fZPSd91yGE9fCcCe6OoQr6E3Bev.jpg",
    imdbRating: 7.4,
    tmdbGenres: [
      { id: 28, name: "Acción" },
      { id: 53, name: "Suspense" },
    ],
    watchProvidersMx: netflixMx,
  },
  {
    name: "Parasite",
    year: 2019,
    kind: TitleKind.MOVIE,
    platform: Platform.MAX,
    queueNote: "Drama y comedia negra.",
    position: 6,
    tmdbId: 496243,
    posterPath: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    imdbRating: 8.5,
    tmdbGenres: [
      { id: 35, name: "Comedia" },
      { id: 53, name: "Suspense" },
      { id: 18, name: "Drama" },
    ],
    watchProvidersMx: maxMx,
  },
  {
    name: "The Grand Budapest Hotel",
    year: 2014,
    kind: TitleKind.MOVIE,
    platform: Platform.PRIME,
    queueNote: "Wes Anderson.",
    position: 7,
    tmdbId: 120467,
    posterPath: "/eWdyYQreja6JGCzqKVFnKoBHORP.jpg",
    imdbRating: 8.1,
    tmdbGenres: [{ id: 35, name: "Comedia" }],
    watchProvidersMx: primeMx,
  },
];

const listDescriptions: Record<string, string> = {
  Épicas: "Espadas, arena y discursos largos.",
  "Visto recientemente": "Cola corta de lo último en el seed.",
  "Vibe Mad Max / Tron": "Cromo, desierto, grid y neón.",
  Favoritas: "Las que se quedan. Tu canon personal, sin fecha de caducidad.",
  "Por rewatch": "Títulos que merecen una segunda (o tercera) pasada.",
};

const ensureDemoUser = async (userId: string) => {
  const passwordHash = await hash(DEMO_PASSWORD, 12);

  return prisma.user.upsert({
    where: { id: userId },
    update: {
      email: DEMO_EMAIL,
      name: "Demo Filmia",
      passwordHash,
      streamingPlatforms: [Platform.NETFLIX, Platform.PRIME, Platform.MAX],
    },
    create: {
      id: userId,
      email: DEMO_EMAIL,
      name: "Demo Filmia",
      passwordHash,
      streamingPlatforms: [Platform.NETFLIX, Platform.PRIME, Platform.MAX],
    },
  });
};

const upsertTag = async (userId: string, name: string) => {
  const slug = slugify(name);
  return prisma.tag.upsert({
    where: { userId_slug: { userId, slug } },
    update: { name },
    create: { userId, name, slug },
  });
};

const upsertCollection = async (userId: string, name: string) => {
  const existing = await prisma.list.findFirst({
    where: { userId, name, kind: ListKind.COLLECTION },
  });
  if (existing) {
    return existing;
  }

  return prisma.list.create({
    data: {
      userId,
      name,
      description: listDescriptions[name],
      kind: ListKind.COLLECTION,
    },
  });
};

const ensureDefaultLists = async (userId: string) => {
  for (const list of DEFAULT_LISTS) {
    await prisma.list.upsert({
      where: { userId_slug: { userId, slug: list.slug } },
      update: {
        name: list.name,
        kind: list.kind,
      },
      create: {
        userId,
        slug: list.slug,
        name: list.name,
        description: list.description,
        kind: list.kind,
      },
    });
  }

  return prisma.list.findUniqueOrThrow({
    where: { userId_slug: { userId, slug: WATCHLIST_SLUG } },
  });
};

const seed = async () => {
  const demoUser = await ensureDemoUser(DEMO_USER_ID);
  const userId = demoUser.id;

  const tagRecords = new Map<string, { id: string }>();
  const listRecords = new Map<string, { id: string }>();

  const uniqueTags = [
    ...new Set([...DEFAULT_TAG_NAMES, ...seedTitles.flatMap((title) => title.tags)]),
  ];
  const uniqueLists = [...new Set(seedTitles.flatMap((title) => title.lists))];

  const watchlist = await ensureDefaultLists(userId);

  for (const tagName of uniqueTags) {
    tagRecords.set(tagName, await upsertTag(userId, tagName));
  }

  for (const listName of uniqueLists) {
    listRecords.set(listName, await upsertCollection(userId, listName));
  }

  for (const [index, title] of seedTitles.entries()) {
    const existing = await prisma.title.findFirst({
      where: { userId, name: title.name, year: title.year },
    });

    const data = {
      userId,
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
      seriesStatus: title.kind === TitleKind.SERIES ? (title.seriesStatus ?? null) : null,
      seriesSeason: title.kind === TitleKind.SERIES ? (title.seriesSeason ?? null) : null,
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
      where: { userId, name: item.name, year: item.year },
    });

    const queueData = {
      kind: item.kind,
      platform: item.platform ?? null,
      tmdbId: item.tmdbId,
      posterPath: item.posterPath,
      imdbRating: item.imdbRating ?? null,
      tmdbGenres: item.tmdbGenres ?? [],
      watchProvidersMx: item.watchProvidersMx ?? undefined,
      seriesStatus:
        item.kind === TitleKind.SERIES ? (item.seriesStatus ?? null) : null,
      seriesSeason:
        item.kind === TitleKind.SERIES ? (item.seriesSeason ?? null) : null,
    };

    const saved = existing
      ? await prisma.title.update({
          where: { id: existing.id },
          data: {
            ...queueData,
            watchedAt: null,
            rating: null,
          },
        })
      : await prisma.title.create({
          data: {
            userId,
            name: item.name,
            year: item.year,
            ...queueData,
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
    `Seed listo: ${seedTitles.length} títulos vistos, ${watchlistQueue.length} en Quiero ver, listas diarias creadas.`,
  );
  console.log(`Usuario demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log("Plataformas de streaming del demo: Netflix, Prime Video y Max.");
};

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
