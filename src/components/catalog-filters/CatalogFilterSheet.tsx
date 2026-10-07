"use client";

import Link from "next/link";
import { CatalogMoreFilters } from "@/components/CatalogMoreFilters";
import {
  CatalogFilmIcon,
  CatalogPlatformChipList,
  CatalogSheetSection,
  CatalogTvIcon,
  catalogSheetChipClass,
} from "@/components/catalog-filters/filter-ui";
import { MX_SHEET_PLATFORMS } from "@/lib/catalog-filters";
import type { CatalogKindFilter, CatalogSort } from "@/lib/catalog-href";
import { focusRing } from "@/lib/ui";
import type { Platform } from "@/db";
import type { SeriesStatusFilter } from "@/lib/series";

const TitleKindMovie = "MOVIE" as const;
const TitleKindSeries = "SERIES" as const;

export type CatalogFilterDraft = {
  kind: CatalogKindFilter;
  platforms: Platform[];
  sort: CatalogSort | null;
  seriesStatus?: SeriesStatusFilter;
  minePlatforms: boolean;
};

type CatalogFilterSheetProps = {
  open: boolean;
  activeCount: number;
  draft: CatalogFilterDraft;
  hasStreamingPlatforms: boolean;
  showKind: boolean;
  showPlatforms: boolean;
  onOpen: () => void;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
  onDraftChange: (next: CatalogFilterDraft | ((current: CatalogFilterDraft) => CatalogFilterDraft)) => void;
};

export const CatalogFilterSheet = ({
  open,
  activeCount,
  draft,
  hasStreamingPlatforms,
  showKind,
  showPlatforms,
  onOpen,
  onClose,
  onClear,
  onApply,
  onDraftChange,
}: CatalogFilterSheetProps) => {
  const handleTogglePlatform = (platform: Platform) => {
    onDraftChange((current) => {
      const selected = current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform];
      return { ...current, platforms: selected, minePlatforms: false };
    });
  };

  return (
    <CatalogMoreFilters
      open={open}
      activeCount={activeCount}
      onOpen={onOpen}
      onClose={onClose}
      onClear={onClear}
      onApply={onApply}
    >
      {showKind ? (
        <CatalogSheetSection title="Tipo">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={draft.kind === TitleKindMovie}
              onClick={() =>
                onDraftChange((current) => ({
                  ...current,
                  kind: current.kind === TitleKindMovie ? "ALL" : TitleKindMovie,
                }))
              }
              className={catalogSheetChipClass(draft.kind === TitleKindMovie)}
            >
              <CatalogFilmIcon />
              Película
            </button>
            <button
              type="button"
              aria-pressed={draft.kind === TitleKindSeries}
              onClick={() =>
                onDraftChange((current) => ({
                  ...current,
                  kind: current.kind === TitleKindSeries ? "ALL" : TitleKindSeries,
                }))
              }
              className={catalogSheetChipClass(draft.kind === TitleKindSeries)}
            >
              <CatalogTvIcon />
              Serie
            </button>
          </div>
        </CatalogSheetSection>
      ) : null}

      {showPlatforms ? (
        <CatalogSheetSection title="Plataforma MX">
          {!hasStreamingPlatforms ? (
            <p className="text-sm text-fog">
              Elige tus plataformas en el{" "}
              <Link
                href="/perfil"
                className={`text-accent underline-offset-2 hover:underline ${focusRing}`}
              >
                perfil
              </Link>{" "}
              para filtrar por suscripción, o toca un logo para ver
              disponibilidad en México.
            </p>
          ) : null}
          <CatalogPlatformChipList
            platforms={MX_SHEET_PLATFORMS.slice(0, 4)}
            selected={draft.platforms}
            onToggle={handleTogglePlatform}
          />
        </CatalogSheetSection>
      ) : null}

      {showPlatforms ? (
        <CatalogSheetSection title="Más plataformas">
          <CatalogPlatformChipList
            platforms={MX_SHEET_PLATFORMS.slice(4)}
            selected={draft.platforms}
            onToggle={handleTogglePlatform}
          />
        </CatalogSheetSection>
      ) : null}

    </CatalogMoreFilters>
  );
};
