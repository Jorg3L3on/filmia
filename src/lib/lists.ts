import { ListKind } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";

export const WATCHLIST_SLUG = "watchlist" as const;
export const FAVORITAS_SLUG = "favoritas" as const;
export const POR_REWATCH_SLUG = "por-rewatch" as const;

export const WATCHLIST_NAME = "Quiero ver";
export const FAVORITAS_NAME = "Favoritas";
export const POR_REWATCH_NAME = "Por rewatch";

export const WATCHLIST_DESCRIPTION =
  "Lo que quieres ver pronto. Ordénalo, anota por qué y márcalo como visto cuando llegue el momento.";
export const FAVORITAS_DESCRIPTION =
  "Las que se quedan. Tu canon personal, sin fecha de caducidad.";
export const POR_REWATCH_DESCRIPTION =
  "Títulos que merecen una segunda (o tercera) pasada.";

export const FIXED_LIST_SLUGS = [
  WATCHLIST_SLUG,
  FAVORITAS_SLUG,
  POR_REWATCH_SLUG,
] as const;

export type FixedListSlug = (typeof FIXED_LIST_SLUGS)[number];

export const DEFAULT_LISTS = [
  {
    slug: WATCHLIST_SLUG,
    name: WATCHLIST_NAME,
    description: WATCHLIST_DESCRIPTION,
    kind: ListKind.WATCHLIST,
  },
  {
    slug: FAVORITAS_SLUG,
    name: FAVORITAS_NAME,
    description: FAVORITAS_DESCRIPTION,
    kind: ListKind.COLLECTION,
  },
  {
    slug: POR_REWATCH_SLUG,
    name: POR_REWATCH_NAME,
    description: POR_REWATCH_DESCRIPTION,
    kind: ListKind.COLLECTION,
  },
] as const;

export const isFixedListSlug = (
  slug: string | null | undefined,
): slug is FixedListSlug =>
  Boolean(slug && FIXED_LIST_SLUGS.includes(slug as FixedListSlug));

export const isReservedListSlug = (slug: string | null | undefined) =>
  isFixedListSlug(slug) || slug === "quiero-ver";

export const listHref = (list: { id: string; slug: string | null; kind?: ListKind }) =>
  list.slug === WATCHLIST_SLUG || list.kind === ListKind.WATCHLIST
    ? "/watchlist"
    : `/listas/${list.id}`;

export const sortUserLists = <T extends { slug: string | null; name: string }>(
  lists: T[],
) => {
  const rank = (slug: string | null) => {
    const index = FIXED_LIST_SLUGS.indexOf(slug as FixedListSlug);
    return index === -1 ? FIXED_LIST_SLUGS.length + 1 : index;
  };

  return [...lists].sort((left, right) => {
    const delta = rank(left.slug) - rank(right.slug);
    if (delta !== 0) {
      return delta;
    }

    return left.name.localeCompare(right.name, "es");
  });
};

export const partitionUserLists = <T extends { slug: string | null; name: string }>(
  lists: T[],
) => {
  const ordered = sortUserLists(lists);
  return {
    fixed: ordered.filter((list) => isFixedListSlug(list.slug)),
    custom: ordered.filter((list) => !isFixedListSlug(list.slug)),
  };
};

export const emptyStateForList = (slug: string | null) => {
  if (slug === WATCHLIST_SLUG) {
    return {
      title: "Nada en Quiero ver",
      description:
        "Agrega títulos desde TMDB, desde su ficha o con el selector. Aquí vive la cola de lo que sigue.",
    };
  }

  if (slug === FAVORITAS_SLUG) {
    return {
      title: "Aún no hay favoritas",
      description:
        "Cuando una película o serie se quede contigo, márcala como favorita desde su ficha.",
    };
  }

  if (slug === POR_REWATCH_SLUG) {
    return {
      title: "Nada para rewatch",
      description:
        "Si una historia pide bis, súbela aquí desde la ficha. El mazo espera.",
    };
  }

  return {
    title: "Esta lista está vacía",
    description:
      "Agrega títulos desde el selector, desde la ficha, o regístralos primero en el diario.",
  };
};

export const ensureDefaultLists = async (userId: string) => {
  const existing = await prisma.list.findMany({
    where: { userId, slug: { in: [...FIXED_LIST_SLUGS] } },
    select: { id: true, slug: true, name: true, kind: true },
  });
  const bySlug = new Map(existing.map((list) => [list.slug, list]));

  await Promise.all(
    DEFAULT_LISTS.map(async (list) => {
      const current = bySlug.get(list.slug);

      if (!current) {
        await prisma.list.create({
          data: {
            userId,
            slug: list.slug,
            name: list.name,
            description: list.description,
            kind: list.kind,
          },
        });
        return;
      }

      if (current.name !== list.name || current.kind !== list.kind) {
        await prisma.list.update({
          where: { id: current.id },
          data: { name: list.name, kind: list.kind },
        });
      }
    }),
  );

  return prisma.list.findMany({
    where: { userId, slug: { in: [...FIXED_LIST_SLUGS] } },
  });
};
