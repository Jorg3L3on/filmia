"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CatalogFilterSheet,
  type CatalogFilterDraft,
} from "@/components/catalog-filters/CatalogFilterSheet";
import { catalogBarChipClass } from "@/components/catalog-filters/filter-ui";
import { KIND_CHIPS, countSheetFilters } from "@/lib/catalog-filters";
import type { CatalogKindFilter, CatalogQuery } from "@/lib/catalog-href";
import { catalogHref } from "@/lib/catalog-href";
import type { Platform } from "@/db";
import type { SeriesStatusFilter } from "@/lib/series";
import type { CatalogSort } from "@/lib/tags";

type FilterTag = {
  id: string;
  name: string;
  slug: string;
  _count?: { titles: number };
};

type CatalogFiltersProps = {
  tags: FilterTag[];
  selectedSlugs: string[];
  pathname: string;
  view?: string;
  sort?: string;
  defaultView?: string;
  defaultSort?: CatalogSort | null;
  minePlatforms?: boolean;
  hasStreamingPlatforms?: boolean;
  showTagFilters?: boolean;
  showKind?: boolean;
  showPlatforms?: boolean;
  showSort?: boolean;
  showSeriesStatus?: boolean;
  seriesStatus?: SeriesStatusFilter;
  month?: string;
  day?: string | null;
  mode?: string;
  kind?: CatalogKindFilter;
  platforms?: Platform[];
};

export const CatalogFilters = ({
  tags,
  selectedSlugs,
  pathname,
  view,
  sort,
  defaultView,
  defaultSort = null,
  minePlatforms = false,
  hasStreamingPlatforms = false,
  showTagFilters = true,
  showKind = true,
  showPlatforms = true,
  showSort = true,
  showSeriesStatus = true,
  seriesStatus,
  month,
  day,
  mode,
  kind = "ALL",
  platforms = [],
}: CatalogFiltersProps) => {
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

  return (
    <section className="space-y-1.5" aria-label="Filtros del catálogo">
      <div className="flex items-center gap-1.5">
        {showKind ? (
          <div
            role="group"
            aria-label="Filtro por tipo"
            className="rail flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5"
          >
            {KIND_CHIPS.map((chip) => {
              const isCurrent = kind === chip.value;
              return (
                <Link
                  key={chip.value}
                  href={hrefFor({ ...applied, kind: chip.value })}
                  aria-current={isCurrent ? "page" : undefined}
                  className={catalogBarChipClass(isCurrent)}
                >
                  {chip.label}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <CatalogFilterSheet
          open={open}
          activeCount={sheetActiveCount}
          draft={draft}
          defaultSort={defaultSort}
          tags={tags}
          hasStreamingPlatforms={hasStreamingPlatforms}
          showKind={showKind}
          showPlatforms={showPlatforms}
          showSort={showSort}
          showSeriesStatus={showSeriesStatus}
          showTagFilters={showTagFilters}
          onOpen={handleOpen}
          onClose={handleClose}
          onClear={handleClear}
          onApply={handleApply}
          onDraftChange={setDraft}
        />
      </div>
    </section>
  );
};
