import Link from "next/link";
import { PersonalRating } from "@/components/PersonalRating";
import { TagPills } from "@/components/TagPills";
import { cn } from "@/lib/cn";
import { titlesInMonth } from "@/lib/dates";
import { focusRing } from "@/lib/ui";
import type { DiaryCalendarTitle } from "@/components/diary-types";

type DiaryMonthListProps = {
  titles: DiaryCalendarTitle[];
  month: string;
};

export const DiaryMonthList = ({ titles, month }: DiaryMonthListProps) => {
  const monthTitles = titlesInMonth(titles, month);

  if (monthTitles.length === 0) {
    return null;
  }

  return (
    <details className="group rounded-2xl border border-line bg-surface open:bg-surface">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm text-fog [&::-webkit-details-marker]:hidden",
          focusRing,
        )}
      >
        <span>
          Lista del mes
          <span className="ml-2 text-mist">
            {monthTitles.length === 1 ? "1 entrada" : `${monthTitles.length} entradas`}
          </span>
        </span>
        <span className="text-xs uppercase tracking-[0.16em] text-accent group-open:hidden">
          Mostrar
        </span>
        <span className="hidden text-xs uppercase tracking-[0.16em] text-accent group-open:inline">
          Ocultar
        </span>
      </summary>
      <ul className="space-y-1 border-t border-line px-2 py-2">
        {monthTitles.map((title) => (
          <li key={title.id}>
            <Link
              href={`/titulos/${title.id}`}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-well",
                focusRing,
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-serif text-base text-paper">
                  {title.name}
                </span>
                {title.tags && title.tags.length > 0 ? (
                  <span className="mt-1 block">
                    <TagPills tags={title.tags.map((item) => item.tag)} compact />
                  </span>
                ) : null}
              </span>
              <PersonalRating rating={title.rating} size="sm" />
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
};
