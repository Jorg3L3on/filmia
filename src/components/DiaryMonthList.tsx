"use client";

import Link from "next/link";
import { PersonalRating } from "@/components/PersonalRating";
import { TagPills } from "@/components/TagPills";
import {
  WINDOW_VIRTUALIZE_AFTER,
  WindowVirtualList,
} from "@/components/WindowVirtualList";
import type { DiaryCalendarTitle } from "@/components/diary-types";
import { cn } from "@/lib/cn";
import { titlesInMonth } from "@/lib/dates";
import { staggerStyle } from "@/lib/motion";
import { focusRing } from "@/lib/ui";

type DiaryMonthListProps = {
  titles: DiaryCalendarTitle[];
  month: string;
};

const MONTH_ROW_HEIGHT = 64;

const MonthTitleRow = ({
  title,
  index = 0,
  animate = false,
}: {
  title: DiaryCalendarTitle;
  index?: number;
  animate?: boolean;
}) => (
  <li
    className={cn("month-list-row", animate && "stagger-in")}
    style={animate ? staggerStyle(index) : undefined}
  >
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
);

export const DiaryMonthList = ({ titles, month }: DiaryMonthListProps) => {
  const monthTitles = titlesInMonth(titles, month);

  if (monthTitles.length === 0) {
    return null;
  }

  const virtualize = monthTitles.length >= WINDOW_VIRTUALIZE_AFTER;

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
      {virtualize ? (
        <WindowVirtualList
          items={monthTitles}
          estimateHeight={MONTH_ROW_HEIGHT}
          className="space-y-1 border-t border-line px-2 py-2"
          itemKey={(title) => title.id}
          renderItem={(title) => <MonthTitleRow key={title.id} title={title} />}
        />
      ) : (
        <ul className="space-y-1 border-t border-line px-2 py-2">
          {monthTitles.map((title, index) => (
            <MonthTitleRow key={title.id} title={title} index={index} animate />
          ))}
        </ul>
      )}
    </details>
  );
};
