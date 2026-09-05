import Link from "next/link";
import { CatalogMoreFilters } from "@/components/CatalogMoreFilters";
import { MinePlatformsToggle } from "@/components/MinePlatformsToggle";
import { cn } from "@/lib/cn";
import {
  SERIES_STATUS_FILTER_OPTIONS,
  type SeriesStatusFilter,
} from "@/lib/series";
import { catalogHref } from "@/lib/tags";
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
  minePlatforms?: boolean;
  hasStreamingPlatforms?: boolean;
  showTagFilters?: boolean;
  seriesStatus?: SeriesStatusFilter;
  month?: string;
  day?: string | null;
  mode?: string;
};

const chipClass = (selected: boolean) =>
  cn(
    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition",
    focusRing,
    selected
      ? "border-accent bg-accent text-ink"
      : "border-chrome text-fog hover:border-[#555] hover:text-white",
  );

export const CatalogFilters = ({
  tags,
  selectedSlugs,
  pathname,
  view,
  sort,
  defaultView,
  minePlatforms = false,
  hasStreamingPlatforms = false,
  showTagFilters = true,
  seriesStatus,
  month,
  day,
  mode,
}: CatalogFiltersProps) => {
  const selected = new Set(selectedSlugs);
  const queryBase = {
    view,
    sort,
    defaultView,
    minePlatforms,
    seriesStatus,
    month,
    day,
    mode,
  };
  const hasActiveFilters = selected.size > 0 || minePlatforms || Boolean(seriesStatus);
  const selectedTags = tags.filter((tag) => selected.has(tag.slug));
  const selectedSeries = SERIES_STATUS_FILTER_OPTIONS.find(
    (option) => option.id === seriesStatus,
  );
  const sheetActiveCount =
    selected.size + (seriesStatus ? 1 : 0) + (minePlatforms ? 1 : 0);
  const clearHref = catalogHref(pathname, { view, sort, defaultView, month, day, mode });

  return (
    <section className="space-y-2" aria-label="Filtros del catálogo">
      <div className="rail flex max-w-full items-center gap-2 overflow-x-auto pb-1">
        {hasStreamingPlatforms ? (
          <Link
            href={catalogHref(pathname, {
              ...queryBase,
              tags: selectedSlugs,
              minePlatforms: !minePlatforms,
            })}
            aria-pressed={minePlatforms}
            aria-label={
              minePlatforms
                ? "Quitar filtro solo en mis plataformas"
                : "Mostrar solo títulos en mis plataformas"
            }
            className={chipClass(minePlatforms)}
          >
            Mis plataformas
          </Link>
        ) : (
          <Link
            href="/perfil"
            aria-label="Elige tus plataformas en el perfil"
            className={chipClass(false)}
          >
            Plataformas
          </Link>
        )}

        {selectedSeries ? (
          <Link
            href={catalogHref(pathname, {
              ...queryBase,
              tags: selectedSlugs,
              seriesStatus: undefined,
            })}
            aria-pressed
            aria-label={`Quitar filtro ${selectedSeries.label}`}
            className={chipClass(true)}
          >
            {selectedSeries.label}
          </Link>
        ) : null}

        {selectedTags.map((tag) => (
          <Link
            key={tag.id}
            href={catalogHref(pathname, {
              ...queryBase,
              tags: selectedSlugs.filter((slug) => slug !== tag.slug),
            })}
            aria-pressed
            aria-label={`Quitar filtro ${tag.name}`}
            className={chipClass(true)}
          >
            {tag.name}
          </Link>
        ))}

        <CatalogMoreFilters activeCount={sheetActiveCount}>
          <MinePlatformsToggle
            pathname={pathname}
            tags={selectedSlugs}
            view={view}
            sort={sort}
            defaultView={defaultView}
            minePlatforms={minePlatforms}
            hasStreamingPlatforms={hasStreamingPlatforms}
            seriesStatus={seriesStatus}
            month={month}
            day={day}
            mode={mode}
          />

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
                Estado de serie
              </p>
              <p className="text-sm text-fog">
                Solo series. Las películas no entran en este filtro.
              </p>
            </div>
            <ul className="flex flex-wrap gap-2">
              {SERIES_STATUS_FILTER_OPTIONS.map((option) => {
                const isSelected = seriesStatus === option.id;
                const nextStatus = isSelected ? undefined : option.id;

                return (
                  <li key={option.id}>
                    <Link
                      href={catalogHref(pathname, {
                        ...queryBase,
                        tags: selectedSlugs,
                        seriesStatus: nextStatus,
                      })}
                      aria-pressed={isSelected}
                      aria-label={
                        isSelected
                          ? `Quitar filtro ${option.label}`
                          : `Filtrar series ${option.label}`
                      }
                      className={chipClass(isSelected)}
                    >
                      {option.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {showTagFilters ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
                    Etiquetas
                  </p>
                  <p className="text-sm text-fog">
                    Filtra por una o varias. Un título entra si tiene{" "}
                    <span className="text-white">cualquiera</span> de las
                    elegidas (OR).
                  </p>
                </div>
                <Link
                  href="/tags"
                  className={`text-xs text-accent underline-offset-2 hover:underline ${focusRing}`}
                >
                  Todas las etiquetas
                </Link>
              </div>

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
                    const isSelected = selected.has(tag.slug);
                    const nextTags = isSelected
                      ? selectedSlugs.filter((slug) => slug !== tag.slug)
                      : [...selectedSlugs, tag.slug];
                    const count = tag._count?.titles;

                    return (
                      <li key={tag.id}>
                        <Link
                          href={catalogHref(pathname, {
                            ...queryBase,
                            tags: nextTags,
                          })}
                          aria-pressed={isSelected}
                          aria-label={
                            isSelected
                              ? `Quitar filtro ${tag.name}`
                              : `Filtrar por ${tag.name}`
                          }
                          className={chipClass(isSelected)}
                        >
                          {tag.name}
                          {typeof count === "number" ? (
                            <span
                              className={isSelected ? "text-ink/70" : "text-mist"}
                            >
                              {count}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {hasActiveFilters ? (
            <Link
              href={clearHref}
              className={`text-xs text-fog underline-offset-2 hover:text-white hover:underline ${focusRing}`}
            >
              Quitar filtros
            </Link>
          ) : null}
        </CatalogMoreFilters>

        {hasActiveFilters ? (
          <Link
            href={clearHref}
            className={`shrink-0 text-xs text-fog underline-offset-2 hover:text-white hover:underline ${focusRing}`}
          >
            Quitar
          </Link>
        ) : null}
      </div>
    </section>
  );
};
