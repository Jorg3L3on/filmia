"use client";

import Link from "next/link";
import { CatalogMoreFilters } from "@/components/CatalogMoreFilters";
import {
  CatalogFilmIcon,
  CatalogOrderIcon,
  CatalogPlatformChipList,
  CatalogSheetSection,
  CatalogTvIcon,
  catalogSheetChipClass,
} from "@/components/catalog-filters/filter-ui";
import {
  CATALOG_ORDER_OPTIONS,
  MX_SHEET_PLATFORMS,
} from "@/lib/catalog-filters";
import type { CatalogKindFilter } from "@/lib/catalog-href";
import { focusRing } from "@/lib/ui";
import type { Platform } from "@/db";
import {
  SERIES_STATUS_FILTER_OPTIONS,
  type SeriesStatusFilter,
} from "@/lib/series";
import type { CatalogSort } from "@/lib/tags";

const TitleKindMovie = "MOVIE" as const;
const TitleKindSeries = "SERIES" as const;

type FilterTag = {
  id: string;
  name: string;
  slug: string;
  _count?: { titles: number };
};

export type CatalogFilterDraft = {
  kind: CatalogKindFilter;
  platforms: Platform[];
  sort: CatalogSort | null;
  tags: string[];
  seriesStatus?: SeriesStatusFilter;
  minePlatforms: boolean;
};

type CatalogFilterSheetProps = {
  open: boolean;
  activeCount: number;
  draft: CatalogFilterDraft;
  defaultSort: CatalogSort | null;
  tags: FilterTag[];
  hasStreamingPlatforms: boolean;
  showKind: boolean;
  showPlatforms: boolean;
  showSort: boolean;
  showSeriesStatus: boolean;
  showTagFilters: boolean;
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
  defaultSort,
  tags,
  hasStreamingPlatforms,
  showKind,
  showPlatforms,
  showSort,
  showSeriesStatus,
  showTagFilters,
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

      {showSort ? (
        <CatalogSheetSection title="Orden">
          <div className="flex flex-wrap gap-2">
            {CATALOG_ORDER_OPTIONS.map((option) => {
              const isSelected = draft.sort === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() =>
                    onDraftChange((current) => ({
                      ...current,
                      sort: current.sort === option.id ? defaultSort : option.id,
                    }))
                  }
                  className={catalogSheetChipClass(isSelected)}
                >
                  <CatalogOrderIcon name={option.icon} />
                  {option.label}
                </button>
              );
            })}
          </div>
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

      {showSeriesStatus ? (
        <CatalogSheetSection
          title="Estado de serie"
          hint="Solo series. Las películas no entran en este filtro."
        >
          <ul className="flex flex-wrap gap-2">
            {SERIES_STATUS_FILTER_OPTIONS.map((option) => {
              const isSelected = draft.seriesStatus === option.id;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      onDraftChange((current) => ({
                        ...current,
                        seriesStatus: isSelected ? undefined : option.id,
                      }))
                    }
                    className={catalogSheetChipClass(isSelected)}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </CatalogSheetSection>
      ) : null}

      {showTagFilters ? (
        <CatalogSheetSection
          title="Etiquetas"
          hint="Un título entra si tiene cualquiera de las elegidas (OR)."
        >
          {tags.length === 0 ? (
            <p className="text-sm text-mist">
              Aún no hay etiquetas. Créalas en un título o en{" "}
              <Link
                href="/tags"
                className={`text-accent hover:underline ${focusRing}`}
              >
                Etiquetas
              </Link>
              .
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isSelected = draft.tags.includes(tag.slug);
                const count = tag._count?.titles;
                return (
                  <li key={tag.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() =>
                        onDraftChange((current) => ({
                          ...current,
                          tags: isSelected
                            ? current.tags.filter((slug) => slug !== tag.slug)
                            : [...current.tags, tag.slug],
                        }))
                      }
                      className={catalogSheetChipClass(isSelected)}
                    >
                      {tag.name}
                      {typeof count === "number" ? (
                        <span className={isSelected ? "text-accent/70" : "text-mist"}>
                          {count}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CatalogSheetSection>
      ) : null}
    </CatalogMoreFilters>
  );
};
