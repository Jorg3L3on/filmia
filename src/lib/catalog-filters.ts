import { Platform, TitleKind } from "@/db";
import type { CatalogKindFilter } from "@/lib/catalog-href";
import { PLATFORMS } from "@/lib/labels";
import type { CatalogSort } from "@/lib/tags";

export const KIND_CHIPS = [
  { value: "ALL" as const, label: "Todos" },
  { value: TitleKind.MOVIE, label: "Películas" },
  { value: TitleKind.SERIES, label: "Series" },
] as const;

export const CATALOG_ORDER_OPTIONS = [
  { id: "recent" as const, label: "Recientes", icon: "clock" },
  { id: "rating" as const, label: "Nota", icon: "star" },
  { id: "name" as const, label: "Título", icon: "az" },
] as const satisfies ReadonlyArray<{
  id: CatalogSort;
  label: string;
  icon: "clock" | "star" | "az";
}>;

const FEATURED_MX: Platform[] = [
  Platform.NETFLIX,
  Platform.DISNEY,
  Platform.MAX,
  Platform.PRIME,
];

export const MX_SHEET_PLATFORMS: Platform[] = [
  ...FEATURED_MX,
  ...PLATFORMS.filter((platform) => !FEATURED_MX.includes(platform)),
];

const lastString = (value: unknown) => {
  if (Array.isArray(value)) {
    return lastString(value.at(-1));
  }
  return typeof value === "string" ? value.trim() : "";
};

export const parseKindFilter = (value: unknown): CatalogKindFilter => {
  const raw = lastString(value).toUpperCase();
  return raw === TitleKind.MOVIE || raw === TitleKind.SERIES ? raw : "ALL";
};

export const parsePlatformFilters = (value: unknown): Platform[] => {
  const raw = Array.isArray(value) ? value : value == null ? [] : [value];
  const selected = new Set<Platform>();

  for (const item of raw) {
    if (typeof item !== "string") {
      continue;
    }

    for (const piece of item.split(",")) {
      const platform = piece.trim().toUpperCase();
      if (PLATFORMS.includes(platform as Platform)) {
        selected.add(platform as Platform);
      }
    }
  }

  return PLATFORMS.filter((platform) => selected.has(platform));
};

export const isCatalogOrder = (
  value: string | undefined | null,
): value is (typeof CATALOG_ORDER_OPTIONS)[number]["id"] =>
  CATALOG_ORDER_OPTIONS.some((option) => option.id === value);

export const parseCatalogOrder = (
  value: unknown,
  fallback: CatalogSort | null = null,
): CatalogSort | null => {
  const raw = lastString(value);
  if (isCatalogOrder(raw)) {
    return raw;
  }
  return fallback;
};

export const countSheetFilters = ({
  platforms = [],
  sort,
  defaultSort = null,
  tags = [],
  seriesStatus,
  minePlatforms = false,
}: {
  platforms?: Platform[];
  sort?: string | null;
  defaultSort?: string | null;
  tags?: string[];
  seriesStatus?: string | null;
  minePlatforms?: boolean;
}) => {
  const sortCounts = sort && sort !== defaultSort ? 1 : 0;
  return (
    platforms.length +
    sortCounts +
    tags.length +
    (seriesStatus ? 1 : 0) +
    (minePlatforms ? 1 : 0)
  );
};

export const sortCatalogItems = <
  T extends { rating: number | null; name: string; updatedAt?: Date | string },
>(
  items: readonly T[],
  sort: CatalogSort | null,
) => {
  if (!sort) {
    return [...items];
  }

  const copy = [...items];

  if (sort === "name") {
    return copy.sort((left, right) => left.name.localeCompare(right.name, "es"));
  }

  if (sort === "rating") {
    return copy.sort((left, right) => {
      const delta = (right.rating ?? -1) - (left.rating ?? -1);
      return delta !== 0 ? delta : left.name.localeCompare(right.name, "es");
    });
  }

  return copy.sort((left, right) => {
    const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
    const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }
    return left.name.localeCompare(right.name, "es");
  });
};

export const titleMatchesKind = (
  kind: TitleKind,
  filter: CatalogKindFilter,
) => filter === "ALL" || kind === filter;

export const sortCatalogByTitle = <
  T extends {
    title: {
      id: string;
      rating: number | null;
      name: string;
      updatedAt?: Date | string;
    };
  },
>(
  items: readonly T[],
  sort: CatalogSort | null,
) => {
  if (!sort) {
    return [...items];
  }

  const ranked = sortCatalogItems(
    items.map((item) => item.title),
    sort,
  );
  const order = new Map(ranked.map((title, index) => [title.id, index]));
  return [...items].sort(
    (left, right) =>
      (order.get(left.title.id) ?? 0) - (order.get(right.title.id) ?? 0),
  );
};
