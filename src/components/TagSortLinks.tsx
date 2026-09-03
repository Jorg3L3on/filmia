import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  catalogHref,
  TAG_SORT_OPTIONS,
  type CatalogSort,
} from "@/lib/tags";
import { focusRing } from "@/lib/ui";
import type { SeriesStatusFilter } from "@/lib/series";

type TagSortLinksProps = {
  pathname: string;
  current: CatalogSort;
  view?: string;
  minePlatforms?: boolean;
  seriesStatus?: SeriesStatusFilter;
};

export const TagSortLinks = ({
  pathname,
  current,
  view,
  minePlatforms = false,
  seriesStatus,
}: TagSortLinksProps) => {
  return (
    <div
      role="group"
      aria-label="Ordenar ranking"
      className="flex flex-wrap gap-2"
    >
      {TAG_SORT_OPTIONS.map((option) => {
        const isCurrent = current === option.id;
        return (
          <Link
            key={option.id}
            href={catalogHref(pathname, {
              view,
              sort: option.id === "rating" ? null : option.id,
              minePlatforms,
              seriesStatus,
            })}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition",
              focusRing,
              isCurrent
                ? "border-accent bg-accent text-ink"
                : "border-chrome text-fog hover:border-[#555] hover:text-white",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
};
