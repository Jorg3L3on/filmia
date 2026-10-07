"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CatalogFilterDraft } from "@/components/catalog-filters/CatalogFilterSheet";
import { countSheetFilters } from "@/lib/catalog-filters";
import { catalogHref, type CatalogKindFilter, type CatalogQuery, type CatalogSort } from "@/lib/catalog-href";
import type { Platform } from "@/db";
import type { SeriesStatusFilter } from "@/lib/series";

type UseCatalogFiltersStateArgs = {
  pathname: string;
  view?: string;
  sort?: string;
  defaultView?: string;
  defaultSort?: CatalogSort | null;
  minePlatforms?: boolean;
  seriesStatus?: SeriesStatusFilter;
  month?: string;
  day?: string | null;
  mode?: string;
  kind?: CatalogKindFilter;
  platforms?: Platform[];
  /** Params owned by another control on the page (Quiero ver rail), kept on every href. */
  extraQuery?: Partial<CatalogQuery>;
};

export const useCatalogFiltersState = ({
  pathname,
  view,
  sort,
  defaultView,
  defaultSort = null,
  minePlatforms = false,
  seriesStatus,
  month,
  day,
  mode,
  kind = "ALL",
  platforms = [],
  extraQuery,
}: UseCatalogFiltersStateArgs) => {
  const router = useRouter();
  const applied: CatalogFilterDraft = {
    kind,
    platforms,
    sort: (sort as CatalogSort | undefined) ?? defaultSort,
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
    ...extraQuery,
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
      seriesStatus: next.seriesStatus,
      minePlatforms: next.minePlatforms,
    });

  /** Sort lives in its own sheet — Limpiar keeps it and the badge ignores it. */
  const clearDraft: CatalogFilterDraft = {
    kind: "ALL",
    platforms: [],
    sort: applied.sort,
    seriesStatus: undefined,
    minePlatforms: false,
  };

  const sheetActiveCount = countSheetFilters({
    platforms,
    seriesStatus,
    minePlatforms,
  });

  const handleSortSelect = (nextSort: CatalogSort) => {
    router.push(hrefFor({ ...applied, sort: nextSort }));
  };

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
    handleSortSelect,
  };
};
