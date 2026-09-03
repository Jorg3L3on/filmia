import Link from "next/link";
import { DiaryRecentList } from "@/components/DiaryRecentList";
import { EmptyState } from "@/components/EmptyState";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import {
  WEEKDAY_LABELS_SHORT,
  formatMonthHeading,
  formatWatchedDate,
  getMonthGrid,
  groupTitlesByWatchedDay,
  isoDateToUtcNoon,
  monthFromIsoDate,
  shiftMonthParam,
  titlesInMonth,
  todayDateInput,
} from "@/lib/dates";
import type { SeriesStatusFilter } from "@/lib/series";
import { catalogHref } from "@/lib/tags";
import { focusRing } from "@/lib/ui";
import type { SeriesStatus, TitleKind } from "@/generated/prisma/client";

export type DiaryCalendarTitle = {
  id: string;
  name: string;
  year: number | null;
  rating: number | null;
  review: string | null;
  watchedAt: Date | null;
  posterPath: string | null;
  kind?: TitleKind;
  seriesStatus?: SeriesStatus | null;
  seriesSeason?: number | null;
  tags?: Array<{ tag: { id: string; name: string; slug: string } }>;
};

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
    month,
    day,
    tags,
    minePlatforms,
    seriesStatus,
  });

const DayCellPosters = ({ titles }: { titles: DiaryCalendarTitle[] }) => {
  const shown = titles.slice(0, 2);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      {shown.map((title, index) => (
        <PosterImage
          key={title.id}
          name={title.name}
          posterPath={title.posterPath}
          ratio="fill"
          sizes="72px"
          className={cn(
            "absolute inset-0",
            index > 0 && "left-1/3 ring-1 ring-canvas/80",
          )}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-canvas-deep/90 via-canvas-deep/25 to-canvas-deep/40" />
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
  const prevMonth = shiftMonthParam(month, -1);
  const nextMonth = shiftMonthParam(month, 1);
  const selectedTitles = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const selectedLabel = selectedDay
    ? formatWatchedDate(isoDateToUtcNoon(selectedDay), "long")
    : null;
  const query = { tags, minePlatforms, seriesStatus };
  const monthCountLabel =
    monthTitles.length === 1 ? "1 entrada" : `${monthTitles.length} entradas`;

  return (
    <div className="space-y-6">
      <section
        className="overflow-hidden rounded-md border border-line bg-surface"
        aria-label={`Calendario de ${monthHeading}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-3 py-3 sm:px-4">
          <Link
            href={calendarHref({ ...query, month: prevMonth })}
            aria-label={`Mes anterior, ${formatMonthHeading(prevMonth)}`}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full border border-chrome text-fog hover:border-[#555] hover:text-white",
              focusRing,
            )}
          >
            <ChevronIcon direction="prev" />
          </Link>
          <div className="min-w-0 text-center">
            <h2 className="font-serif text-2xl tracking-tight text-white first-letter:uppercase sm:text-[1.75rem]">
              {monthHeading}
            </h2>
            <p className="text-[11px] uppercase tracking-[0.18em] text-mist">
              {monthCountLabel} este mes
            </p>
          </div>
          <Link
            href={calendarHref({ ...query, month: nextMonth })}
            aria-label={`Mes siguiente, ${formatMonthHeading(nextMonth)}`}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full border border-chrome text-fog hover:border-[#555] hover:text-white",
              focusRing,
            )}
          >
            <ChevronIcon direction="next" />
          </Link>
        </header>

        <div className="grid grid-cols-7 border-b border-line bg-well/60">
          {WEEKDAY_LABELS_SHORT.map((label) => (
            <p
              key={label}
              className="px-1 py-2 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-mist"
            >
              {label}
            </p>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const dayTitles = byDay.get(cell.isoDate) ?? [];
            const hasEntries = dayTitles.length > 0;
            const isSelected = selectedDay === cell.isoDate;
            const isToday = cell.isoDate === today;
            const cellMonth = monthFromIsoDate(cell.isoDate);
            const href = calendarHref({
              ...query,
              month: cellMonth,
              day: isSelected && cell.inMonth ? null : cell.isoDate,
            });
            const countLabel =
              dayTitles.length === 1
                ? "1 visionado"
                : `${dayTitles.length} visionados`;
            const dateLabel = formatWatchedDate(
              isoDateToUtcNoon(cell.isoDate),
              "long",
            );
            const ariaLabel = [
              dateLabel,
              hasEntries ? countLabel : "sin visionados",
              isToday ? "hoy" : null,
              isSelected ? "día seleccionado" : null,
            ]
              .filter(Boolean)
              .join(", ");

            return (
              <Link
                key={cell.isoDate}
                href={href}
                aria-label={ariaLabel}
                aria-current={isSelected ? "date" : undefined}
                className={cn(
                  "relative min-h-[4.25rem] overflow-hidden border-b border-r border-line sm:min-h-[5.5rem] [&:nth-child(7n)]:border-r-0",
                  focusRing,
                  !cell.inMonth && "bg-canvas-deep/40",
                  isSelected && "ring-2 ring-inset ring-accent",
                )}
              >
                {hasEntries ? <DayCellPosters titles={dayTitles} /> : null}
                <span
                  className={cn(
                    "relative z-10 m-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs",
                    isToday && "bg-accent font-semibold text-ink",
                    !isToday && hasEntries && "text-white",
                    !isToday && !hasEntries && cell.inMonth && "text-fog",
                    !isToday && !cell.inMonth && "text-faint",
                  )}
                >
                  {cell.day}
                </span>
                {hasEntries ? (
                  <span className="absolute bottom-1 left-1 z-10 flex items-center gap-0.5">
                    {dayTitles.slice(0, 3).map((title) => (
                      <span
                        key={title.id}
                        className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(0,224,84,0.7)]"
                      />
                    ))}
                    {dayTitles.length > 3 ? (
                      <span className="pl-0.5 text-[10px] font-medium text-accent">
                        +{dayTitles.length - 3}
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {dayTitles.length > 1 ? (
                  <span className="absolute bottom-1 right-1 z-10 rounded-full bg-canvas/80 px-1.5 text-[10px] font-medium text-white">
                    {dayTitles.length}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>

      {monthTitles.length === 0 ? (
        <EmptyState
          title={
            titles.length === 0 && hasActiveFilters
              ? "Nada con esos filtros"
              : titles.length === 0
                ? "El diario está vacío"
                : "Nada visto este mes"
          }
          description={
            titles.length === 0 && hasActiveFilters
              ? "Prueba otra combinación o quita filtros. El estado de serie ignora películas."
              : titles.length === 0
                ? "Registra un título o corre el seed para ver tus posters."
                : "Cambia de mes o registra un visionado con otra fecha."
          }
          actionHref={
            titles.length === 0 && hasActiveFilters
              ? clearHref
              : titles.length === 0
                ? "/buscar"
                : calendarHref({ ...query, month: currentAdjacentWithEntries(titles, month) })
          }
          actionLabel={
            titles.length === 0 && hasActiveFilters
              ? "Quitar filtros"
              : titles.length === 0
                ? "Buscar en TMDB"
                : "Ir a un mes con entradas"
          }
        />
      ) : selectedDay ? (
        selectedTitles.length > 0 ? (
          <DiaryRecentList
            titles={selectedTitles}
            heading={selectedLabel ?? "Ese día"}
          />
        ) : (
          <p className="rounded-md border border-dashed border-chrome bg-well/70 px-4 py-6 text-center text-sm text-fog">
            No hay visionados el {selectedLabel}. Toca otro día.
          </p>
        )
      ) : (
        <p className="text-sm text-fog">
          Toca un día para ver título, nota y comentario. Cada entrada abre la
          ficha.
        </p>
      )}
    </div>
  );
};

const currentAdjacentWithEntries = (
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
