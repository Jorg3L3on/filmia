import Link from "next/link";
import { MinePlatformsToggle } from "@/components/MinePlatformsToggle";
import { cn } from "@/lib/cn";
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
  minePlatforms?: boolean;
  hasStreamingPlatforms?: boolean;
  showTagFilters?: boolean;
};

export const CatalogFilters = ({
  tags,
  selectedSlugs,
  pathname,
  view,
  sort,
  minePlatforms = false,
  hasStreamingPlatforms = false,
  showTagFilters = true,
}: CatalogFiltersProps) => {
  const selected = new Set(selectedSlugs);
  const queryBase = { view, sort, minePlatforms };
  const hasActiveFilters = selected.size > 0 || minePlatforms;

  return (
    <section
      className="space-y-5 rounded-md border border-line bg-surface p-4"
      aria-label="Filtros del catálogo"
    >
      <MinePlatformsToggle
        pathname={pathname}
        tags={selectedSlugs}
        view={view}
        sort={sort}
        minePlatforms={minePlatforms}
        hasStreamingPlatforms={hasStreamingPlatforms}
      />

      {showTagFilters ? (
        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
                Etiquetas
              </p>
              <p className="text-sm text-fog">
                Filtra por una o varias. Un título entra si tiene{" "}
                <span className="text-white">cualquiera</span> de las elegidas
                (OR).
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {hasActiveFilters ? (
                <Link
                  href={catalogHref(pathname, { view, sort })}
                  className={`text-xs text-fog underline-offset-2 hover:text-white hover:underline ${focusRing}`}
                >
                  Quitar filtros
                </Link>
              ) : null}
              <Link
                href="/tags"
                className={`text-xs text-accent underline-offset-2 hover:underline ${focusRing}`}
              >
                Todas las etiquetas
              </Link>
            </div>
          </div>

          {tags.length === 0 ? (
            <p className="text-sm text-mist">
              Aún no hay etiquetas. Créalas en un título o en{" "}
              <Link href="/tags" className={`text-accent hover:underline ${focusRing}`}>
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
                      href={catalogHref(pathname, { ...queryBase, tags: nextTags })}
                      aria-pressed={isSelected}
                      aria-label={
                        isSelected
                          ? `Quitar filtro ${tag.name}`
                          : `Filtrar por ${tag.name}`
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition",
                        focusRing,
                        isSelected
                          ? "border-accent bg-accent text-ink"
                          : "border-chrome text-fog hover:border-[#555] hover:text-white",
                      )}
                    >
                      {tag.name}
                      {typeof count === "number" ? (
                        <span className={isSelected ? "text-ink/70" : "text-mist"}>
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
      ) : hasActiveFilters ? (
        <Link
          href={catalogHref(pathname, { view, sort })}
          className={`text-xs text-fog underline-offset-2 hover:text-white hover:underline ${focusRing}`}
        >
          Quitar filtros
        </Link>
      ) : null}
    </section>
  );
};
