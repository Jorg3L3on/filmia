"use client";

import {
  CatalogFilterSheet,
} from "@/components/catalog-filters/CatalogFilterSheet";
import { CatalogKindChips } from "@/components/catalog-filters/CatalogKindChips";
import { CatalogMinePlatformsChip } from "@/components/catalog-filters/CatalogMinePlatformsChip";
import { CatalogSortSheet } from "@/components/catalog-filters/CatalogSortSheet";
import { useCatalogFiltersState } from "@/components/catalog-filters/useCatalogFiltersState";
import { CATALOG_ORDER_OPTIONS, type CatalogOrderOption } from "@/lib/catalog-filters";
import type { CatalogKindFilter, CatalogQuery, CatalogSort } from "@/lib/catalog-href";
import type { Platform } from "@/db";
import type { SeriesStatusFilter } from "@/lib/series";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type CatalogFiltersProps = {
  pathname: string;
  view?: string;
  sort?: string;
  defaultView?: string;
  defaultSort?: CatalogSort | null;
  minePlatforms?: boolean;
  hasStreamingPlatforms?: boolean;
  showKind?: boolean;
  /** `false` keeps Tipo only inside the Filtros sheet. */
  showKindChips?: boolean;
  orderOptions?: ReadonlyArray<CatalogOrderOption>;
  /** Bar toggle «En mis plataformas» (takes the left slot instead of kind chips). */
  showMinePlatformsChip?: boolean;
  /**
   * «Mis plataformas» already has a chip in `leading` (Quiero ver rail, FIL-I24-3): the Filtros
   * badge must not count it a second time.
   */
  minePlatformsInBar?: boolean;
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
  /**
   * Phone compact header (FIL-I21-7): the title sits on the Filtros row (with `headingActions`
   * beside the round Filtros button) and `leading` takes its own row below. Desktop ignores it.
   */
  heading?: ReactNode;
  headingActions?: ReactNode;
};

export const CatalogFilters = ({
  pathname,
  view,
  sort,
  defaultView,
  defaultSort = null,
  minePlatforms = false,
  hasStreamingPlatforms = false,
  showKind = true,
  showKindChips = true,
  orderOptions = CATALOG_ORDER_OPTIONS,
  showMinePlatformsChip = false,
  minePlatformsInBar = showMinePlatformsChip,
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
  heading,
  headingActions,
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
    (minePlatformsInBar && minePlatforms ? 1 : 0);

  const compact = Boolean(heading);

  return (
    <section className="space-y-1" aria-label="Filtros del catálogo">
      <div
        className={cn(
          "flex items-center gap-1.5",
          compact &&
            "max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto_auto] max-sm:items-center max-sm:gap-x-2 max-sm:gap-y-1",
        )}
      >
        {compact ? (
          <>
            <div className="min-w-0 sm:hidden max-sm:[grid-area:1/1]">{heading}</div>
            {headingActions ? <div className="sm:hidden max-sm:[grid-area:1/2]">{headingActions}</div> : null}
          </>
        ) : null}
        {leading ? (
          <div className={cn("min-w-0 flex-1", compact && "max-sm:[grid-area:2/1/3/4]")}>{leading}</div>
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

        <div className={cn("shrink-0", compact && "max-sm:[grid-area:1/3]")}>
          <CatalogFilterSheet
            open={open}
            activeCount={activeCount}
            draft={draft}
            hasStreamingPlatforms={hasStreamingPlatforms}
            showKind={showKind}
            showPlatforms={showPlatforms}
            onOpen={handleOpen}
            onClose={handleClose}
            onClear={handleClear}
            onApply={handleApply}
            onDraftChange={setDraft}
            compactOnMobile={compact}
          />
        </div>
      </div>
    </section>
  );
};
