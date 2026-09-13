import Link from "next/link";
import { cn } from "@/lib/cn";
import type { DiaryCategory } from "@/lib/diary-picks";
import { diaryHref } from "@/lib/diary-picks";
import { focusRing } from "@/lib/ui";

type DiaryGenreToggleProps = {
  categories: readonly DiaryCategory[];
  activeSlug: string;
  /** Client continuum: select without full document navigation. */
  onSelect?: (slug: string) => void;
};

export const DiaryGenreToggle = ({
  categories,
  activeSlug,
  onSelect,
}: DiaryGenreToggleProps) => {
  if (categories.length === 0) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="Categorías de Quiero ver"
      className="rail flex max-w-full flex-nowrap justify-center gap-1 overflow-x-auto px-0.5"
    >
      {categories.map((category) => {
        const isCurrent = category.slug === activeSlug;
        const className = cn(
          "que-ver-chip shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] tab-transition",
          focusRing,
          isCurrent ? "que-ver-chip-active" : "que-ver-chip-mist",
        );

        if (onSelect) {
          return (
            <button
              key={category.id}
              type="button"
              aria-current={isCurrent ? "true" : undefined}
              aria-pressed={isCurrent}
              onClick={() => onSelect(category.slug)}
              className={className}
            >
              {category.name}
            </button>
          );
        }

        return (
          <Link
            key={category.id}
            href={diaryHref(category.slug)}
            aria-current={isCurrent ? "page" : undefined}
            className={className}
          >
            {category.name}
          </Link>
        );
      })}
    </div>
  );
};
