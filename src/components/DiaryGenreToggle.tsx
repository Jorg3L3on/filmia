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
      className="rail flex max-w-full flex-nowrap overflow-x-auto rounded-full border border-chrome bg-well p-1"
    >
      {categories.map((category) => {
        const isCurrent = category.slug === activeSlug;
        return (
          <Link
            key={category.id}
            href={diaryHref(category.slug)}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition",
              focusRing,
              isCurrent ? "bg-accent text-ink" : "text-fog hover:text-white",
            )}
          >
            {category.name}
          </Link>
        );
      })}
    </div>
  );
};
