"use client";

import {
  CatalogFilterSheet,
} from "@/components/catalog-filters/CatalogFilterSheet";
import { CatalogKindChips } from "@/components/catalog-filters/CatalogKindChips";
import { useCatalogFiltersState } from "@/components/catalog-filters/useCatalogFiltersState";
import type { CatalogKindFilter } from "@/lib/catalog-href";
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
  const {
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
  } = useCatalogFiltersState({
    pathname,
    view,
    sort,
    defaultView,
    defaultSort,
    minePlatforms,
    selectedSlugs,
    seriesStatus,
    month,
    day,
    mode,
    kind,
    platforms,
  });

  return (
    <section className="space-y-1" aria-label="Filtros del catálogo">
      <div className="flex items-center gap-1">
        {showKind ? (
          <CatalogKindChips kind={kind} applied={applied} hrefFor={hrefFor} />
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
