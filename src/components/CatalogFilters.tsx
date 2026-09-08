"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CatalogMoreFilters } from "@/components/CatalogMoreFilters";
import { PlatformLogo } from "@/components/PlatformLogo";
import { cn } from "@/lib/cn";
import {
  CATALOG_ORDER_OPTIONS,
  countSheetFilters,
  KIND_CHIPS,
  MX_SHEET_PLATFORMS,
} from "@/lib/catalog-filters";
import type { CatalogKindFilter, CatalogQuery } from "@/lib/catalog-href";
import { catalogHref } from "@/lib/catalog-href";
import { PLATFORM_LABEL } from "@/lib/labels";
import type { Platform } from "@/db";
import {
  SERIES_STATUS_FILTER_OPTIONS,
  type SeriesStatusFilter,
} from "@/lib/series";
import type { CatalogSort } from "@/lib/tags";
import { focusRing } from "@/lib/ui";

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

type Draft = {
  kind: CatalogKindFilter;
  platforms: Platform[];
  sort: CatalogSort | null;
  tags: string[];
  seriesStatus?: SeriesStatusFilter;
  minePlatforms: boolean;
};

const barChipClass = (selected: boolean) =>
  cn(
    "inline-flex shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium transition",
    focusRing,
    selected
      ? "bg-accent text-ink"
      : "bg-well text-paper hover:bg-chrome",
  );

const sheetChipClass = (selected: boolean) =>
  cn(
    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition",
    focusRing,
    selected
      ? "border-accent bg-accent/10 text-accent"
      : "border-chrome bg-well text-fog hover:border-line-hover hover:text-paper",
  );

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
  const applied: Draft = {
    kind,
    platforms,
    sort: (sort as CatalogSort | undefined) ?? defaultSort,
    tags: selectedSlugs,
    seriesStatus,
    minePlatforms,
  };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(applied);

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

  const hrefFor = (next: Draft) =>
    catalogHref(pathname, {
      ...queryBase,
      kind: next.kind,
      platforms: next.platforms,
      sort: next.sort && next.sort !== defaultSort ? next.sort : null,
      tags: next.tags,
      seriesStatus: next.seriesStatus,
      minePlatforms: next.minePlatforms,
    });

  const clearDraft: Draft = {
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

  const handleTogglePlatform = (platform: Platform) => {
    setDraft((current) => {
      const selected = current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform];
      return { ...current, platforms: selected, minePlatforms: false };
    });
  };

  return (
    <section className="space-y-2" aria-label="Filtros del catálogo">
      <div className="flex items-center gap-2">
        {showKind ? (
          <div
            role="group"
            aria-label="Filtro por tipo"
            className="rail flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1"
          >
            {KIND_CHIPS.map((chip) => {
              const isCurrent = kind === chip.value;
              return (
                <Link
                  key={chip.value}
                  href={hrefFor({ ...applied, kind: chip.value })}
                  aria-current={isCurrent ? "page" : undefined}
                  className={barChipClass(isCurrent)}
                >
                  {chip.label}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <CatalogMoreFilters
          open={open}
          activeCount={sheetActiveCount}
          onOpen={handleOpen}
          onClose={handleClose}
          onClear={handleClear}
          onApply={handleApply}
        >
          {showKind ? (
            <SheetSection title="Tipo">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={draft.kind === TitleKindMovie}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      kind: current.kind === TitleKindMovie ? "ALL" : TitleKindMovie,
                    }))
                  }
                  className={sheetChipClass(draft.kind === TitleKindMovie)}
                >
                  <FilmIcon />
                  Película
                </button>
                <button
                  type="button"
                  aria-pressed={draft.kind === TitleKindSeries}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      kind: current.kind === TitleKindSeries ? "ALL" : TitleKindSeries,
                    }))
                  }
                  className={sheetChipClass(draft.kind === TitleKindSeries)}
                >
                  <TvIcon />
                  Serie
                </button>
              </div>
            </SheetSection>
          ) : null}

          {showPlatforms ? (
            <SheetSection title="Plataforma MX">
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
              <PlatformChipList
                platforms={MX_SHEET_PLATFORMS.slice(0, 4)}
                selected={draft.platforms}
                onToggle={handleTogglePlatform}
              />
            </SheetSection>
          ) : null}

          {showSort ? (
            <SheetSection title="Orden">
              <div className="flex flex-wrap gap-2">
                {CATALOG_ORDER_OPTIONS.map((option) => {
                  const isSelected = draft.sort === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          sort: current.sort === option.id ? defaultSort : option.id,
                        }))
                      }
                      className={sheetChipClass(isSelected)}
                    >
                      <OrderIcon name={option.icon} />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </SheetSection>
          ) : null}

          {showPlatforms ? (
            <SheetSection title="Más plataformas">
              <PlatformChipList
                platforms={MX_SHEET_PLATFORMS.slice(4)}
                selected={draft.platforms}
                onToggle={handleTogglePlatform}
              />
            </SheetSection>
          ) : null}

          {showSeriesStatus ? (
            <SheetSection
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
                          setDraft((current) => ({
                            ...current,
                            seriesStatus: isSelected ? undefined : option.id,
                          }))
                        }
                        className={sheetChipClass(isSelected)}
                      >
                        {option.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </SheetSection>
          ) : null}

          {showTagFilters ? (
            <SheetSection
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
                            setDraft((current) => ({
                              ...current,
                              tags: isSelected
                                ? current.tags.filter((slug) => slug !== tag.slug)
                                : [...current.tags, tag.slug],
                            }))
                          }
                          className={sheetChipClass(isSelected)}
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
            </SheetSection>
          ) : null}
        </CatalogMoreFilters>
      </div>
    </section>
  );
};

const TitleKindMovie = "MOVIE" as const;
const TitleKindSeries = "SERIES" as const;

const PlatformChipList = ({
  platforms,
  selected,
  onToggle,
}: {
  platforms: Platform[];
  selected: Platform[];
  onToggle: (platform: Platform) => void;
}) => (
  <ul className="flex flex-wrap gap-2">
    {platforms.map((platform) => {
      const isSelected = selected.includes(platform);
      return (
        <li key={platform}>
          <button
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(platform)}
            className={sheetChipClass(isSelected)}
          >
            <PlatformLogo platform={platform} size={18} />
            {PLATFORM_LABEL[platform]}
          </button>
        </li>
      );
    })}
  </ul>
);

const SheetSection = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-3">
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
        {title}
      </p>
      {hint ? <p className="text-sm text-fog">{hint}</p> : null}
    </div>
    {children}
  </div>
);

const FilmIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <rect x="4" y="6" width="16" height="12" rx="1.5" />
    <path strokeLinecap="round" d="M8 6v12M16 6v12M4 10h4M16 10h4M4 14h4M16 14h4" />
  </svg>
);

const TvIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <rect x="4" y="7" width="16" height="11" rx="1.5" />
    <path strokeLinecap="round" d="M8 20h8M12 7 9.5 4.5M12 7l2.5-2.5" />
  </svg>
);

const OrderIcon = ({ name }: { name: "clock" | "star" | "az" }) => {
  if (name === "star") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
        <path strokeLinejoin="round" d="m12 4.5 2.1 4.4 4.8.6-3.5 3.3.9 4.8L12 15.4 7.7 17.6l.9-4.8-3.5-3.3 4.8-.6Z" />
      </svg>
    );
  }

  if (name === "az") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
        <path strokeLinecap="round" d="M7 7h6M8.5 7 12 17M10 13h5M17 7v10M17 17l-2-2M17 17l2-2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <circle cx="12" cy="12" r="7.25" />
      <path strokeLinecap="round" d="M12 8.5V12l2.5 2" />
    </svg>
  );
};
