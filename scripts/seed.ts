import { config as loadEnv } from "dotenv";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";

loadEnv({ path: ".env.local" });
loadEnv();

import {
  db,
  listItems,
  lists,
  tags,
  titleTags,
  titles,
  users,
  type Platform,
  type SeriesStatus,
  type TitleKind,
} from "../src/db/index";
import { hashPassword } from "../src/lib/auth/password";
import { slugify } from "../src/lib/labels";
import { DEFAULT_LISTS, WATCHLIST_SLUG } from "../src/lib/lists";
import { DEFAULT_TAG_NAMES } from "../src/lib/tags";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida.");
}

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
  overview?: string;
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
    kind: "MOVIE",
    year: 2000,
    rating: 9,
    review: "Épica de arena y honor. Seed de gusto, no un diario personal.",
    platform: "PRIME",
    tags: ["Épica / guerra", "Histórico"],
    lists: ["Épicas", "Favoritas"],
    watched: true,
    tmdbId: 98,
    posterPath: "/wN2xWp1eIwCKOD0BHTcErTBv1Uq.jpg",
  },
  {
    name: "Troy",
    kind: "MOVIE",
    year: 2004,
    rating: 7,
    review: "Homero con bloquebuster: bronce, playa y discurso.",
    platform: "MAX",
    tags: ["Épica / guerra", "Histórico"],
    lists: ["Épicas"],
    watched: true,
    tmdbId: 652,
    posterPath: "/a07wLy4ONfpsjnBqMwhlWTJTcm.jpg",
  },
  {
    name: "Athena",
    originalName: "Athena",
    kind: "MOVIE",
    year: 2022,
    rating: 8,
    review: "Romain Gavras. Tensión urbana en un solo aliento.",
    platform: "NETFLIX",
    tags: ["Thriller", "francés"],
    lists: ["Visto recientemente"],
    watched: true,
    tmdbId: 852046,
    posterPath: "/posters/athena-2022.png",
  },
  {
    name: "The Northman",
    kind: "MOVIE",
    year: 2022,
    rating: 8,
    review: "Venganza nórdica, barro y mito.",
    platform: "PRIME",
    tags: ["Épica / guerra", "Histórico"],
    lists: ["Épicas", "Favoritas"],
    watched: true,
    tmdbId: 639933,
    posterPath: "/aSSJMnHknzKjlZ6zybwD7eyJ4Po.jpg",
  },
  {
    name: "Mad Max: Fury Road",
    kind: "MOVIE",
    year: 2015,
    rating: 10,
    review: "Vibe desierto/cromo. Persecución absoluta.",
    platform: "MAX",
    tags: ["Visual / espectáculo", "Vibe Mad Max"],
    lists: ["Vibe Mad Max / Tron", "Por rewatch"],
    watched: true,
    tmdbId: 76341,
    posterPath: "/ulcAi4dKpAjHwYGS08vNyx9H6I9.jpg",
  },
  {
    name: "Tron: Legacy",
    kind: "MOVIE",
    year: 2010,
    rating: 7,
    review: "Neón, grid y soundtrack. Vibe Tron.",
    platform: "DISNEY",
    tags: ["Sci-fi", "Visual / espectáculo", "Vibe Tron"],
    lists: ["Vibe Mad Max / Tron", "Por rewatch"],
    watched: true,
    tmdbId: 20526,
    posterPath: "/8Nc6R8k7bG8frSiDJo0oLucF7dN.jpg",
  },
  {
    name: "Dune: Part Two",
    originalName: "Dune: Part Two",
    kind: "MOVIE",
    year: 2024,
    rating: 9,
    review: "Arena, política y mesías. Dummy seed.",
    platform: "MAX",
    tags: ["Sci-fi", "Épica / guerra", "Visual / espectáculo"],
    lists: ["Épicas", "Visto recientemente", "Favoritas"],
    watched: true,
    tmdbId: 693134,
    posterPath: "/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg",
  },
  {
    name: "Breaking Bad",
    kind: "SERIES",
    year: 2008,
    rating: 10,
    review: "Canon. Terminada, sin checklist de episodios.",
    platform: "NETFLIX",
    tags: ["Thriller"],
    lists: ["Favoritas"],
    watched: true,
    seriesStatus: "FINISHED",
    tmdbId: 1396,
    posterPath: "/ztkUQFLlC19CCMYHW9o1zWhT7eW.jpg",
  },
  {
    name: "The Last of Us",
    kind: "SERIES",
    year: 2023,
    rating: 9,
    review: "Viendo. Temporada actual, sin progreso por capítulo.",
    platform: "MAX",
    tags: ["Thriller"],
    lists: ["Visto recientemente"],
    watched: true,
    seriesStatus: "WATCHING",
    seriesSeason: 2,
    tmdbId: 100088,
    posterPath: "/dmo6TYjN9W6FbdC8pQO3nWKmGvl.jpg",
  },
];

const watchlistQueue: WatchlistSeed[] = [
  {
    name: "Blade Runner 2049",
    year: 2017,
    kind: "MOVIE",
    platform: "NETFLIX",
    queueNote: "Revisar la fotografía otra vez.",
    position: 0,
    tmdbId: 335984,
    posterPath: "/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg",
    imdbRating: 8.0,
    overview:
      "El oficial K, un blade runner, descubre un secreto que lo lleva a buscar a Rick Deckard, desaparecido hace treinta años.",
    tmdbGenres: [
      { id: 878, name: "Ciencia ficción" },
      { id: 18, name: "Drama" },
    ],
    watchProvidersMx: netflixMx,
  },
  {
    name: "Interstellar",
    year: 2014,
    kind: "MOVIE",
    platform: "PRIME",
    queueNote: "Para un domingo largo.",
    position: 1,
    tmdbId: 157336,
    posterPath: "/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg",
    imdbRating: 8.7,
    overview:
      "Un grupo de exploradores viaja a través de un agujero de gusano en el espacio para asegurar la supervivencia de la humanidad.",
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
    kind: "SERIES",
    platform: "MAX",
    queueNote: "Temporada 2 pendiente.",
    position: 2,
    tmdbId: 95396,
    posterPath: "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
    seriesStatus: "WATCHING",
    seriesSeason: 2,
    imdbRating: 8.7,
    overview:
      "Los empleados de Lumon Industries se someten a un procedimiento que separa sus recuerdos del trabajo y de la vida personal.",
    tmdbGenres: [
      { id: 18, name: "Drama" },
      { id: 9648, name: "Misterio" },
    ],
    watchProvidersMx: maxMx,
  },
  {
    name: "The Dark Knight",
    year: 2008,
    kind: "MOVIE",
    platform: "MAX",
    queueNote: "Nolan otra vez.",
    position: 3,
    tmdbId: 155,
    posterPath: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    imdbRating: 9.0,
    overview:
      "Batman enfrenta al Joker, un criminal que sumerge a Gotham en el caos y pone a prueba el límite del héroe.",
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
    kind: "MOVIE",
    platform: "NETFLIX",
    queueNote: "Comedia rápida.",
    position: 4,
    tmdbId: 8363,
    posterPath: "/ek8e8txUyUwd2BNqj6lFEerJfbq.jpg",
    imdbRating: 7.6,
    overview:
      "Dos amigos intentan comprar alcohol para una fiesta y terminar el instituto con una última noche caótica.",
    tmdbGenres: [{ id: 35, name: "Comedia" }],
    watchProvidersMx: netflixMx,
  },
  {
    name: "John Wick",
    year: 2014,
    kind: "MOVIE",
    platform: "NETFLIX",
    queueNote: "Acción limpia.",
    position: 5,
    tmdbId: 245891,
    posterPath: "/fZPSd91yGE9fCcCe6OoQr6E3Bev.jpg",
    imdbRating: 7.4,
    overview:
      "Un exasesino sale de su retiro para vengar a su perro y se enfrenta a un sindicato criminal implacable.",
    tmdbGenres: [
      { id: 28, name: "Acción" },
      { id: 53, name: "Suspense" },
    ],
    watchProvidersMx: netflixMx,
  },
  {
    name: "Parasite",
    year: 2019,
    kind: "MOVIE",
    platform: "MAX",
    queueNote: "Drama y comedia negra.",
    position: 6,
    tmdbId: 496243,
    posterPath: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    imdbRating: 8.5,
    overview:
      "La vida de dos familias de Seúl se entrelaza cuando el hijo de una de ellas consigue trabajo en casa de los Park.",
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
    kind: "MOVIE",
    platform: "PRIME",
    queueNote: "Wes Anderson.",
    position: 7,
    tmdbId: 120467,
    posterPath: "/eWdyYQreja6JGCzqKVFnKoBHORP.jpg",
    imdbRating: 8.1,
    overview:
      "Un conserje de un hotel europeo se ve envuelto en el robo de un cuadro y una persecución a través del continente.",
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
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const streamingPlatforms = ["NETFLIX", "PRIME", "MAX"] as Platform[];

  const existing = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (existing) {
    await db
      .update(users)
      .set({
        email: DEMO_EMAIL,
        name: "Demo Filmia",
        passwordHash,
        streamingPlatforms,
      })
      .where(eq(users.id, userId));
    return existing;
  }

  await db.insert(users).values({
    id: userId,
    email: DEMO_EMAIL,
    name: "Demo Filmia",
    passwordHash,
    streamingPlatforms,
  });

  return db.query.users.findFirst({ where: eq(users.id, userId) }).then((user) => {
    if (!user) {
      throw new Error("No se pudo crear el usuario demo.");
    }
    return user;
  });
};

const upsertTag = async (userId: string, name: string) => {
  const slug = slugify(name);
  const existing = await db.query.tags.findFirst({
    where: and(eq(tags.userId, userId), eq(tags.slug, slug)),
  });

  if (existing) {
    await db.update(tags).set({ name }).where(eq(tags.id, existing.id));
    return existing;
  }

  const tagId = createId();
  await db.insert(tags).values({ id: tagId, userId, name, slug });
  return db.query.tags.findFirst({ where: eq(tags.id, tagId) }).then((tag) => {
    if (!tag) {
      throw new Error("No se pudo crear la etiqueta.");
    }
    return tag;
  });
};

const upsertCollection = async (userId: string, name: string) => {
  const existing = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.name, name), eq(lists.kind, "COLLECTION")),
  });
  if (existing) {
    return existing;
  }

  const listId = createId();
  await db.insert(lists).values({
    id: listId,
    userId,
    name,
    description: listDescriptions[name],
    kind: "COLLECTION",
  });

  return db.query.lists.findFirst({ where: eq(lists.id, listId) }).then((list) => {
    if (!list) {
      throw new Error("No se pudo crear la lista.");
    }
    return list;
  });
};

const ensureDefaultListsForSeed = async (userId: string) => {
  for (const list of DEFAULT_LISTS) {
    await db
      .insert(lists)
      .values({
        id: createId(),
        userId,
        slug: list.slug,
        name: list.name,
        description: list.description,
        kind: list.kind,
      })
      .onConflictDoUpdate({
        target: [lists.userId, lists.slug],
        set: { name: list.name, kind: list.kind },
      });
  }

  const watchlist = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
  });

  if (!watchlist) {
    throw new Error("No se pudo crear Quiero ver.");
  }

  return watchlist;
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

  const watchlist = await ensureDefaultListsForSeed(userId);

  for (const tagName of uniqueTags) {
    tagRecords.set(tagName, await upsertTag(userId, tagName));
  }

  for (const listName of uniqueLists) {
    listRecords.set(listName, await upsertCollection(userId, listName));
  }

  for (const [index, title] of seedTitles.entries()) {
    const existing = await db.query.titles.findFirst({
      where: and(eq(titles.userId, userId), eq(titles.name, title.name), eq(titles.year, title.year)),
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
      seriesStatus: title.kind === "SERIES" ? (title.seriesStatus ?? null) : null,
      seriesSeason: title.kind === "SERIES" ? (title.seriesSeason ?? null) : null,
    };

    let savedId = existing?.id;
    if (existing) {
      await db.update(titles).set(data).where(eq(titles.id, existing.id));
    } else {
      savedId = createId();
      await db.insert(titles).values({ id: savedId, ...data });
    }

    const titleId = savedId!;

    await db.delete(titleTags).where(eq(titleTags.titleId, titleId));
    if (title.tags.length > 0) {
      await db.insert(titleTags).values(
        title.tags.map((tagName) => ({
          titleId,
          tagId: tagRecords.get(tagName)!.id,
        })),
      );
    }

    for (const listName of title.lists) {
      await db
        .insert(listItems)
        .values({
          listId: listRecords.get(listName)!.id,
          titleId,
          position: index,
        })
        .onConflictDoUpdate({
          target: [listItems.listId, listItems.titleId],
          set: { position: index },
        });
    }
  }

  for (const item of watchlistQueue) {
    const existing = await db.query.titles.findFirst({
      where: and(eq(titles.userId, userId), eq(titles.name, item.name), eq(titles.year, item.year)),
    });

    const queueData = {
      kind: item.kind,
      platform: item.platform ?? null,
      tmdbId: item.tmdbId,
      posterPath: item.posterPath,
      imdbRating: item.imdbRating ?? null,
      overview: item.overview ?? null,
      tmdbGenres: item.tmdbGenres ?? [],
      watchProvidersMx: item.watchProvidersMx ?? null,
      seriesStatus: item.kind === "SERIES" ? (item.seriesStatus ?? null) : null,
      seriesSeason: item.kind === "SERIES" ? (item.seriesSeason ?? null) : null,
    };

    let savedId = existing?.id;
    if (existing) {
      await db
        .update(titles)
        .set({
          ...queueData,
          watchedAt: null,
          rating: null,
        })
        .where(eq(titles.id, existing.id));
    } else {
      savedId = createId();
      await db.insert(titles).values({
        id: savedId,
        userId,
        name: item.name,
        year: item.year,
        ...queueData,
      });
    }

    const titleId = savedId!;

    await db
      .insert(listItems)
      .values({
        listId: watchlist.id,
        titleId,
        position: item.position,
        queueNote: item.queueNote,
      })
      .onConflictDoUpdate({
        target: [listItems.listId, listItems.titleId],
        set: {
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

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
