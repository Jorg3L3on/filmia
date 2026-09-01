import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  Platform,
  PrismaClient,
  TitleKind,
} from "../src/generated/prisma/client";
import { slugify } from "../src/lib/labels";

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
  rating: number;
  review: string;
  platform: Platform;
  tags: string[];
  lists: string[];
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

const upsertList = async (name: string) => {
  const existing = await prisma.list.findFirst({ where: { name } });
  if (existing) {
    return existing;
  }

  return prisma.list.create({
    data: {
      name,
      description: listDescriptions[name],
    },
  });
};

const seed = async () => {
  const tagRecords = new Map<string, { id: string }>();
  const listRecords = new Map<string, { id: string }>();

  const uniqueTags = [...new Set(seedTitles.flatMap((title) => title.tags))];
  const uniqueLists = [...new Set(seedTitles.flatMap((title) => title.lists))];

  for (const tagName of uniqueTags) {
    tagRecords.set(tagName, await upsertTag(tagName));
  }

  for (const listName of uniqueLists) {
    listRecords.set(listName, await upsertList(listName));
  }

  for (const [index, title] of seedTitles.entries()) {
    const existing = await prisma.title.findFirst({
      where: { name: title.name, year: title.year },
    });

    const data = {
      name: title.name,
      originalName: title.originalName,
      kind: title.kind,
      year: title.year,
      rating: title.rating,
      review: title.review,
      platform: title.platform,
      watchedAt: new Date(`${title.year}-06-15T12:00:00.000Z`),
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

  console.log(`Seed listo: ${seedTitles.length} títulos dummy.`);
};

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
