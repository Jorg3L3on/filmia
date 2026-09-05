"use client";

import Link from "next/link";
import { useState } from "react";
import { DayLogSheet } from "@/components/DayLogSheet";
import { DeckViewToggle, type DeckViewMode } from "@/components/DeckViewToggle";
import { SharedPoster } from "@/components/SharedPoster";
import { PosterImage } from "@/components/PosterImage";
import type { DiaryCalendarTitle } from "@/components/diary-types";
import { cn } from "@/lib/cn";
import {
  WEEKDAY_LABELS_SHORT,
  formatMonthHeading,
  formatMonthName,
  formatWatchedDate,
  getMonthGrid,
  groupTitlesByWatchedDay,
  isoDateToUtcNoon,
  monthFromIsoDate,
  shiftMonthParam,
  titlesInMonth,
  todayDateInput,
} from "@/lib/dates";
import { staggerStyle, useLongPress } from "@/lib/motion";
import type { SeriesStatusFilter } from "@/lib/series";
import { catalogHref } from "@/lib/catalog-href";
import { btnPrimary, focusRing } from "@/lib/ui";

export type { DiaryCalendarTitle };

type DiaryCalendarProps = {
  titles: DiaryCalendarTitle[];
  month: string;
  selectedDay: string | null;
  tags?: string[];
  minePlatforms?: boolean;
  seriesStatus?: SeriesStatusFilter;
  hasActiveFilters?: boolean;
  clearHref: string;
};

const calendarHref = ({
  month,
  day,
  tags,
  minePlatforms,
  seriesStatus,
}: {
  month: string;
  day?: string | null;
  tags?: string[];
  minePlatforms?: boolean;
  seriesStatus?: SeriesStatusFilter;
}) =>
  catalogHref("/", {
    view: "calendar",
    defaultView: "calendar",
    mode: "historial",
    month,
    day,
    tags,
    minePlatforms,
    seriesStatus,
  });

const DayCellPosters = ({ titles }: { titles: DiaryCalendarTitle[] }) => {
  const shown = titles.slice(0, 2);
  const extra = titles.length - 2;

  return (
    <div className="absolute inset-0 overflow-hidden rounded-[8px]" aria-hidden="true">
      {shown.map((title, index) => (
        <SharedPoster
          key={title.id}
          titleId={title.id}
          className={cn(
            "absolute inset-0",
            index > 0 && "left-[28%] ring-1 ring-canvas/80",
          )}
        >
          <PosterImage
            name={title.name}
            posterPath={title.posterPath}
            ratio="fill"
            sizes="72px"
            className="h-full rounded-none"
          />
        </SharedPoster>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-canvas-deep/80 via-transparent to-canvas-deep/20" />
      {extra > 0 ? (
        <span className="absolute right-1 bottom-1 z-10 rounded-full bg-canvas/85 px-1.5 text-[10px] font-semibold text-paper">
          +{extra}
        </span>
      ) : null}
    </div>
  );
};

export const DiaryCalendar = ({
  titles,
  month,
  selectedDay,
  tags = [],
  minePlatforms = false,
  seriesStatus,
  hasActiveFilters = false,
  clearHref,
}: DiaryCalendarProps) => {
  const today = todayDateInput();
  const cells = getMonthGrid(month);
  const byDay = groupTitlesByWatchedDay(titles);
  const monthTitles = titlesInMonth(titles, month);
  const monthHeading = formatMonthHeading(month);
  const monthName = formatMonthName(month);
  const prevMonth = shiftMonthParam(month, -1);
  const nextMonth = shiftMonthParam(month, 1);
  const query = { tags, minePlatforms, seriesStatus };
  const hrefFor = (mode: DeckViewMode) =>
    catalogHref("/", {
      tags,
      view: mode,
      defaultView: "calendar",
      mode: "historial",
      minePlatforms,
      seriesStatus,
      month,
      day: mode === "calendar" ? selectedDay : undefined,
    });
  const monthCountLabel =
    monthTitles.length === 1 ? "1 entrada" : `${monthTitles.length} entradas`;
  const [sheetDay, setSheetDay] = useState<string | null>(null);
  const sheetTitles = sheetDay ? (byDay.get(sheetDay) ?? []) : [];
  const sheetLabel = sheetDay
    ? formatWatchedDate(isoDateToUtcNoon(sheetDay), "long")
    : "";

  return (
    <div className="space-y-5 px-0">
      <section
        className="overflow-hidden rounded-2xl bg-transparent"
        aria-label={`Calendario de ${monthHeading}`}
      >
        <header className="flex items-center justify-between gap-2 px-0 py-1">
          <Link
            href={calendarHref({ ...query, month: prevMonth })}
            aria-label={`Mes anterior, ${formatMonthHeading(prevMonth)}`}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full text-fog hover:bg-well hover:text-paper",
              focusRing,
            )}
          >
            <ChevronIcon direction="prev" />
          </Link>
          <div className="min-w-0 text-center">
            <h2 className="font-serif text-2xl tracking-tight text-paper first-letter:uppercase sm:text-[1.85rem]">
              {monthHeading}
            </h2>
            <p className="text-[11px] uppercase tracking-[0.18em] text-mist">
              {monthCountLabel} este mes
            </p>
          </div>
          <div className="flex items-center gap-1">
            {hrefFor ? (
              <DeckViewToggle
                mode="calendar"
                hrefFor={hrefFor}
                modes={["deck", "grid"]}
                variant="icons"
              />
            ) : null}
            <Link
              href={calendarHref({ ...query, month: nextMonth })}
              aria-label={`Mes siguiente, ${formatMonthHeading(nextMonth)}`}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full text-fog hover:bg-well hover:text-paper",
                focusRing,
              )}
            >
              <ChevronIcon direction="next" />
            </Link>
          </div>
        </header>

        <div className="mt-4 grid grid-cols-7 gap-1.5 px-0">
          {WEEKDAY_LABELS_SHORT.map((label) => (
            <p
              key={label}
              className="px-1 pb-1 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-mist"
            >
              {label}
            </p>
          ))}
        </div>

        <div className="diary-month grid grid-cols-7 gap-1.5 sm:gap-2">
          {cells.map((cell, index) => {
            const dayTitles = byDay.get(cell.isoDate) ?? [];
            return (
              <CalendarDayCell
                key={cell.isoDate}
                cell={cell}
                titles={dayTitles}
                today={today}
                selected={selectedDay === cell.isoDate}
                query={query}
                index={index}
                onOpenSheet={() => setSheetDay(cell.isoDate)}
              />
            );
          })}
        </div>

        {monthTitles.length === 0 ? (
          <div className="mt-6 space-y-3 text-center">
            <p className="font-serif text-xl text-paper">
              {hasActiveFilters
                ? "Nada con esos filtros"
                : titles.length === 0
                  ? "El diario está vacío"
                  : `Nada visto en ${monthName}`}
            </p>
            <p className="text-sm text-fog">
              {hasActiveFilters
                ? "Prueba otra combinación o quita filtros."
                : `Registra tu primera de ${monthName}`}
            </p>
            <Link
              href={
                hasActiveFilters
                  ? clearHref
                  : `/buscar?fecha=${month}-01&destino=visto`
              }
              className={btnPrimary}
            >
              {hasActiveFilters ? "Quitar filtros" : `Registra tu primera de ${monthName}`}
            </Link>
          </div>
        ) : null}
      </section>

      <DayLogSheet
        open={Boolean(sheetDay && sheetTitles.length > 0)}
        label={sheetLabel}
        titles={sheetTitles}
        onClose={() => setSheetDay(null)}
      />
    </div>
  );
};

const CalendarDayCell = ({
  cell,
  titles,
  today,
  selected,
  query,
  index,
  onOpenSheet,
}: {
  cell: { isoDate: string; day: number; inMonth: boolean };
  titles: DiaryCalendarTitle[];
  today: string;
  selected: boolean;
  query: {
    tags?: string[];
    minePlatforms?: boolean;
    seriesStatus?: SeriesStatusFilter;
  };
  index: number;
  onOpenSheet: () => void;
}) => {
  const hasEntries = titles.length > 0;
  const isToday = cell.isoDate === today;
  const primary = titles[0];
  const emptyHref = `/buscar?fecha=${cell.isoDate}&destino=visto`;
  const titleHref = primary ? `/titulos/${primary.id}` : emptyHref;
  const longPress = useLongPress(() => {
    if (hasEntries) {
      onOpenSheet();
    }
  });

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!hasEntries) {
      return;
    }

    if (titles.length > 1 && event.shiftKey) {
      event.preventDefault();
      onOpenSheet();
    }
  };

  const dateLabel = formatWatchedDate(isoDateToUtcNoon(cell.isoDate), "long");
  const countLabel =
    titles.length === 1 ? "1 visionado" : `${titles.length} visionados`;
  const ariaLabel = [
    dateLabel,
    hasEntries ? countLabel : "sin visionados",
    isToday ? "hoy" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      href={hasEntries ? titleHref : emptyHref}
      aria-label={ariaLabel}
      aria-current={selected ? "date" : undefined}
      data-iso-date={cell.isoDate}
      onClick={handleClick}
      className={cn(
        "relative aspect-square overflow-hidden rounded-[8px] press-scale stagger-in",
        focusRing,
        hasEntries ? "bg-well" : "bg-well",
        !cell.inMonth && "opacity-40",
        isToday && !hasEntries && "ring-1 ring-accent/40",
      )}
      style={staggerStyle(index, 50)}
      {...(hasEntries ? longPress : {})}
    >
      {hasEntries ? <DayCellPosters titles={titles} /> : null}
      <span
        className={cn(
          "absolute top-1 left-1 z-10 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-medium",
          hasEntries
            ? "bg-canvas/80 text-paper"
            : isToday
              ? "text-accent"
              : "text-mist",
        )}
      >
        {cell.day}
      </span>
    </Link>
  );
};

const ChevronIcon = ({ direction }: { direction: "prev" | "next" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    className="h-5 w-5"
    aria-hidden="true"
  >
    {direction === "prev" ? (
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 6 8.5 12l6 6" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 6 15.5 12l-6 6" />
    )}
  </svg>
);

export const currentAdjacentWithEntries = (
  titles: DiaryCalendarTitle[],
  fallbackMonth: string,
) => {
  const grouped = groupTitlesByWatchedDay(titles);
  const months = [...grouped.keys()]
    .map((isoDate) => monthFromIsoDate(isoDate))
    .sort();

  if (months.length === 0) {
    return fallbackMonth;
  }

  return months[months.length - 1] ?? fallbackMonth;
};
