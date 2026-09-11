"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CatalogFilterDraft } from "@/components/catalog-filters/CatalogFilterSheet";
import { countSheetFilters } from "@/lib/catalog-filters";
import type { CatalogKindFilter, CatalogQuery } from "@/lib/catalog-href";
import { catalogHref } from "@/lib/catalog-href";
import type { Platform } from "@/db";
import type { SeriesStatusFilter } from "@/lib/series";
import type { CatalogSort } from "@/lib/tags";

type UseCatalogFiltersStateArgs = {
  pathname: string;
  view?: string;
  sort?: string;
  defaultView?: string;
  defaultSort?: CatalogSort | null;
  minePlatforms?: boolean;
  selectedSlugs: string[];
  seriesStatus?: SeriesStatusFilter;
  month?: string;
  day?: string | null;
  mode?: string;
  kind?: CatalogKindFilter;
  platforms?: Platform[];
};

export const useCatalogFiltersState = ({
  pathname,
  view,
  sort,
  defaultView,
  defaultSort = null,
  minePlatforms = false,
  selectedSlugs,
  seriesStatus,
  month,
  day,
  mode,
  kind = "ALL",
  platforms = [],
}: UseCatalogFiltersStateArgs) => {
  const router = useRouter();
  const applied: CatalogFilterDraft = {
    kind,
    platforms,
    sort: (sort as CatalogSort | undefined) ?? defaultSort,
    tags: selectedSlugs,
    seriesStatus,
    minePlatforms,
  };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogFilterDraft>(applied);

  const handleOpen = () => {
    setDraft(applied);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const queryBase = {
    view,
    defaultView,
    month,
    day,
    mode,
  } satisfies Partial<CatalogQuery>;

  const hrefFor = (next: CatalogFilterDraft) =>
    catalogHref(pathname, {
      ...queryBase,
      kind: next.kind,
      platforms: next.platforms,
      sort: next.sort && next.sort !== defaultSort ? next.sort : null,
      tags: next.tags,
      seriesStatus: next.seriesStatus,
      minePlatforms: next.minePlatforms,
    });

  const clearDraft: CatalogFilterDraft = {
    kind: "ALL",
    platforms: [],
    sort: defaultSort,
    tags: [],
    seriesStatus: undefined,
    minePlatforms: false,
  };

  const sheetActiveCount = countSheetFilters({
    platforms,
    sort: applied.sort,
    defaultSort,
    tags: selectedSlugs,
    seriesStatus,
    minePlatforms,
  });

  const handleApply = () => {
    router.push(hrefFor(draft));
    setOpen(false);
  };

  const handleClear = () => {
    setDraft(clearDraft);
    router.push(hrefFor(clearDraft));
    setOpen(false);
  };

  return {
    applied,
    open,
    draft,
    setDraft,
    hrefFor,
    sheetActiveCount,
    handleOpen,
    handleClose,
    handleApply,
    handleClear,
  };
};
