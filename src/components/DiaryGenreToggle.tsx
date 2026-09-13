import Link from "next/link";
import { cn } from "@/lib/cn";
import type { DiaryCategory } from "@/lib/diary-picks";
import { diaryHref } from "@/lib/diary-picks";
import { focusRing } from "@/lib/ui";

type DiaryGenreToggleProps = {
  categories: readonly DiaryCategory[];
  activeSlug: string;
};

export const DiaryGenreToggle = ({
  categories,
  activeSlug,
}: DiaryGenreToggleProps) => {
  if (categories.length === 0) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="Categorías de Quiero ver"
      className="rail flex max-w-full flex-nowrap justify-center gap-0.5 overflow-x-auto px-0.5"
    >
      {categories.map((category) => {
        const isCurrent = category.slug === activeSlug;
        return (
          <Link
            key={category.id}
            href={diaryHref(category.slug)}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] tab-transition",
              focusRing,
              isCurrent ? "bg-accent/85 text-ink" : "text-mist hover:text-fog",
            )}
          >
            {category.name}
          </Link>
        );
      })}
    </div>
  );
};
