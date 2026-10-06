"use client";

import {
  CatalogFilterSheet,
} from "@/components/catalog-filters/CatalogFilterSheet";
import { CatalogKindChips } from "@/components/catalog-filters/CatalogKindChips";
import { CatalogMinePlatformsChip } from "@/components/catalog-filters/CatalogMinePlatformsChip";
import { CatalogSortSheet } from "@/components/catalog-filters/CatalogSortSheet";
import { useCatalogFiltersState } from "@/components/catalog-filters/useCatalogFiltersState";
import { CATALOG_ORDER_OPTIONS, type CatalogOrderOption } from "@/lib/catalog-filters";
import type { CatalogKindFilter, CatalogQuery } from "@/lib/catalog-href";
import type { Platform } from "@/db";
import type { SeriesStatusFilter } from "@/lib/series";
import type { CatalogSort } from "@/lib/tags";
import type { ReactNode } from "react";

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
  /** `false` keeps Tipo only inside the Filtros sheet. */
  showKindChips?: boolean;
  orderOptions?: ReadonlyArray<CatalogOrderOption>;
  /** Bar toggle «En mis plataformas» (takes the left slot instead of kind chips). */
  showMinePlatformsChip?: boolean;
  showPlatforms?: boolean;
  showSort?: boolean;
  seriesStatus?: SeriesStatusFilter;
  month?: string;
  day?: string | null;
  mode?: string;
  kind?: CatalogKindFilter;
  platforms?: Platform[];
  /** Replaces the left slot (Quiero ver rail). */
  leading?: ReactNode;
  /** Page-specific params the Filtros sheet must carry along (Quiero ver rail). */
  extraQuery?: Partial<CatalogQuery>;
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
  showKindChips = true,
  orderOptions = CATALOG_ORDER_OPTIONS,
  showMinePlatformsChip = false,
  showPlatforms = true,
  showSort = true,
  seriesStatus,
  month,
  day,
  mode,
  kind = "ALL",
  platforms = [],
  leading,
  extraQuery,
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
    handleSortSelect,
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
    extraQuery,
  });
  const kindInSheetOnly = showKind && !showKindChips;
  const activeCount =
    sheetActiveCount +
    (kindInSheetOnly && kind !== "ALL" ? 1 : 0) -
    (showMinePlatformsChip && minePlatforms ? 1 : 0);

  return (
    <section className="space-y-1" aria-label="Filtros del catálogo">
      <div className="flex items-center gap-1.5">
        {leading ? (
          <div className="min-w-0 flex-1">{leading}</div>
        ) : showMinePlatformsChip ? (
          <CatalogMinePlatformsChip applied={applied} hrefFor={hrefFor} />
        ) : showKind && showKindChips ? (
          <CatalogKindChips kind={kind} applied={applied} hrefFor={hrefFor} />
        ) : (
          <div className="flex-1" />
        )}

        {showSort ? (
          <CatalogSortSheet
            options={orderOptions}
            current={applied.sort}
            onSelect={handleSortSelect}
          />
        ) : null}

        <CatalogFilterSheet
          open={open}
          activeCount={activeCount}
          draft={draft}
          tags={tags}
          hasStreamingPlatforms={hasStreamingPlatforms}
          showKind={showKind}
          showPlatforms={showPlatforms}
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
