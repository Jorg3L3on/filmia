import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray } from "drizzle-orm";
import { cache } from "react";
import { db, lists, type ListKind } from "@/db";

export const WATCHLIST_SLUG = "watchlist" as const;
export const FAVORITAS_SLUG = "favoritas" as const;
export const POR_REWATCH_SLUG = "por-rewatch" as const;
export const SERIES_EN_PROGRESO_SLUG = "series-en-progreso" as const;
export const SERIES_ABANDONADAS_SLUG = "series-abandonadas" as const;

export const WATCHLIST_NAME = "Quiero ver";
export const FAVORITAS_NAME = "Favoritas";
export const POR_REWATCH_NAME = "Por rewatch";
export const SERIES_EN_PROGRESO_NAME = "Series en progreso";
export const SERIES_ABANDONADAS_NAME = "Series abandonadas";

export const WATCHLIST_DESCRIPTION =
  "Lo que quieres ver pronto. Ordénalo, anota por qué y márcalo como visto cuando llegue el momento.";
export const FAVORITAS_DESCRIPTION =
  "Las que se quedan. Tu canon personal, sin fecha de caducidad.";
export const POR_REWATCH_DESCRIPTION =
  "Títulos que merecen una segunda (o tercera) pasada.";
export const SERIES_EN_PROGRESO_DESCRIPTION =
  "Las series que marcaste como Viendo. Se llena sola con el estado de la ficha.";
export const SERIES_ABANDONADAS_DESCRIPTION =
  "Las series que dejaste a medias. Se llena sola cuando marcas Abandonada.";

/**
 * Listas fijas que se alimentan solas con el estado de seguimiento de una serie.
 * No se crean con las listas por defecto: aparecen la primera vez que hacen falta.
 */
export const SERIES_STATUS_LISTS = [
  {
    slug: SERIES_EN_PROGRESO_SLUG,
    name: SERIES_EN_PROGRESO_NAME,
    description: SERIES_EN_PROGRESO_DESCRIPTION,
    kind: "COLLECTION" as ListKind,
  },
  {
    slug: SERIES_ABANDONADAS_SLUG,
    name: SERIES_ABANDONADAS_NAME,
    description: SERIES_ABANDONADAS_DESCRIPTION,
    kind: "COLLECTION" as ListKind,
  },
] as const;

export type SeriesStatusListSlug = (typeof SERIES_STATUS_LISTS)[number]["slug"];

export const SERIES_STATUS_LIST_SLUGS: readonly SeriesStatusListSlug[] =
  SERIES_STATUS_LISTS.map((list) => list.slug);

export const isSeriesStatusListSlug = (
  slug: string | null | undefined,
): slug is SeriesStatusListSlug =>
  Boolean(slug && SERIES_STATUS_LIST_SLUGS.includes(slug as SeriesStatusListSlug));

export const FIXED_LIST_SLUGS = [
  WATCHLIST_SLUG,
  FAVORITAS_SLUG,
  POR_REWATCH_SLUG,
  SERIES_EN_PROGRESO_SLUG,
  SERIES_ABANDONADAS_SLUG,
] as const;

export type FixedListSlug = (typeof FIXED_LIST_SLUGS)[number];

export const DEFAULT_LISTS = [
  {
    slug: WATCHLIST_SLUG,
    name: WATCHLIST_NAME,
    description: WATCHLIST_DESCRIPTION,
    kind: "WATCHLIST" as ListKind,
  },
  {
    slug: FAVORITAS_SLUG,
    name: FAVORITAS_NAME,
    description: FAVORITAS_DESCRIPTION,
    kind: "COLLECTION" as ListKind,
  },
  {
    slug: POR_REWATCH_SLUG,
    name: POR_REWATCH_NAME,
    description: POR_REWATCH_DESCRIPTION,
    kind: "COLLECTION" as ListKind,
  },
] as const;

export const isFixedListSlug = (
  slug: string | null | undefined,
): slug is FixedListSlug =>
  Boolean(slug && FIXED_LIST_SLUGS.includes(slug as FixedListSlug));

export const isReservedListSlug = (slug: string | null | undefined) =>
  isFixedListSlug(slug) || slug === "quiero-ver";

export const listHref = (list: { id: string; slug: string | null; kind?: ListKind }) =>
  list.slug === WATCHLIST_SLUG || list.kind === "WATCHLIST"
    ? "/watchlist"
    : `/listas/${list.id}`;

export const sortUserLists = <T extends { slug: string | null; name: string }>(
  listRows: T[],
) => {
  const rank = (slug: string | null) => {
    const index = FIXED_LIST_SLUGS.indexOf(slug as FixedListSlug);
    return index === -1 ? FIXED_LIST_SLUGS.length + 1 : index;
  };

  return [...listRows].sort((left, right) => {
    const delta = rank(left.slug) - rank(right.slug);
    if (delta !== 0) {
      return delta;
    }

    return left.name.localeCompare(right.name, "es");
  });
};

export const partitionUserLists = <T extends { slug: string | null; name: string }>(
  listRows: T[],
) => {
  const ordered = sortUserLists(listRows);
  return {
    fixed: ordered.filter((list) => isFixedListSlug(list.slug)),
    custom: ordered.filter((list) => !isFixedListSlug(list.slug)),
  };
};

export const emptyStateForList = (slug: string | null) => {
  if (slug === WATCHLIST_SLUG) {
    return {
      title: "Aún no hay nada en Quiero ver",
      description: "Añade títulos desde Buscar o desde una ficha.",
      actionHref: "/buscar",
      actionLabel: "Ir a Buscar",
      variant: "watchlist" as const,
    };
  }

  if (slug === FAVORITAS_SLUG) {
    return {
      title: "Aún no hay favoritas",
      description:
        "Cuando una película o serie se quede contigo, márcala desde su ficha.",
      actionHref: "/buscar",
      actionLabel: "Ir a Buscar",
      variant: "listas" as const,
    };
  }

  if (slug === POR_REWATCH_SLUG) {
    return {
      title: "Nada para rewatch",
      description: "Si una historia pide bis, súbela aquí desde la ficha.",
      actionHref: "/buscar",
      actionLabel: "Ir a Buscar",
      variant: "listas" as const,
    };
  }

  if (slug === SERIES_EN_PROGRESO_SLUG) {
    return {
      title: "Ninguna serie en progreso",
      description: "Marca una serie como Viendo desde su ficha y aparecerá aquí.",
      actionHref: "/buscar",
      actionLabel: "Ir a Buscar",
      variant: "listas" as const,
    };
  }

  if (slug === SERIES_ABANDONADAS_SLUG) {
    return {
      title: "Ninguna serie abandonada",
      description: "Cuando marques una serie como Abandonada, se guarda aquí sola.",
      actionHref: "/buscar",
      actionLabel: "Ir a Buscar",
      variant: "listas" as const,
    };
  }

  return {
    title: "Esta lista está vacía",
    description: "Añade títulos desde Buscar o desde una ficha.",
    actionHref: "/buscar",
    actionLabel: "Ir a Buscar",
    variant: "listas" as const,
  };
};

export {
  membershipCopy,
  titleListMembership,
  type TitleListMembership,
} from "@/lib/list-membership";

export const ensureDefaultLists = cache(async (userId: string) => {
  const existing = await db.query.lists.findMany({
    where: and(eq(lists.userId, userId), inArray(lists.slug, [...FIXED_LIST_SLUGS])),
    columns: { id: true, slug: true, name: true, kind: true },
  });
  const bySlug = new Map(existing.map((list) => [list.slug, list]));

  await Promise.all(
    DEFAULT_LISTS.map(async (list) => {
      const current = bySlug.get(list.slug);

      if (!current) {
        const now = new Date();
        await db.insert(lists).values({
          id: createId(),
          userId,
          slug: list.slug,
          name: list.name,
          description: list.description,
          kind: list.kind,
          createdAt: now,
          updatedAt: now,
        });
        return;
      }

      if (current.name !== list.name || current.kind !== list.kind) {
        await db.update(lists).set({ name: list.name, kind: list.kind }).where(eq(lists.id, current.id));
      }
    }),
  );

  return db.query.lists.findMany({
    where: and(eq(lists.userId, userId), inArray(lists.slug, [...FIXED_LIST_SLUGS])),
  });
});

/**
 * Devuelve el id de la lista por estado de serie del usuario, creándola si aún
 * no existe. El índice único (userId, slug) hace la creación segura ante
 * carreras: si otra petición la creó antes, se reutiliza esa.
 */
export const ensureSeriesStatusList = async (
  userId: string,
  slug: SeriesStatusListSlug,
) => {
  const definition = SERIES_STATUS_LISTS.find((list) => list.slug === slug);
  if (!definition) {
    throw new Error("Lista de estado desconocida.");
  }

  const now = new Date();
  await db
    .insert(lists)
    .values({
      id: createId(),
      userId,
      slug: definition.slug,
      name: definition.name,
      description: definition.description,
      kind: definition.kind,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const list = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, slug)),
    columns: { id: true },
  });

  if (!list) {
    throw new Error("No se pudo preparar la lista de la serie.");
  }

  return list.id;
};
