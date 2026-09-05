import Link from "next/link";
import { DeckViewToggle, type DeckViewMode } from "@/components/DeckViewToggle";
import { cn } from "@/lib/cn";
import { formatMonthHeading, shiftMonthParam } from "@/lib/dates";
import { catalogHref } from "@/lib/tags";
import { focusRing } from "@/lib/ui";
import type { SeriesStatusFilter } from "@/lib/series";

type DiaryViewHeaderProps = {
  month: string;
  view: DeckViewMode;
  hrefFor: (mode: DeckViewMode) => string;
  tags?: string[];
  minePlatforms?: boolean;
  seriesStatus?: SeriesStatusFilter;
};

export const DiaryViewHeader = ({
  month,
  view,
  hrefFor,
  tags = [],
  minePlatforms = false,
  seriesStatus,
}: DiaryViewHeaderProps) => {
  const query = {
    tags,
    minePlatforms,
    seriesStatus,
    defaultView: "calendar" as const,
    mode: "historial",
  };
  const prevMonth = shiftMonthParam(month, -1);
  const nextMonth = shiftMonthParam(month, 1);

  return (
    <header className="flex items-center justify-between gap-2">
      <Link
        href={catalogHref("/", { ...query, view, month: prevMonth })}
        aria-label={`Mes anterior, ${formatMonthHeading(prevMonth)}`}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full text-fog hover:bg-well hover:text-paper",
          focusRing,
        )}
      >
        <ChevronIcon direction="prev" />
      </Link>
      <div className="min-w-0 text-center">
        <h1 className="font-serif text-2xl tracking-tight text-paper first-letter:uppercase sm:text-[1.85rem]">
          {formatMonthHeading(month)}
        </h1>
      </div>
      <div className="flex items-center gap-1">
        <DeckViewToggle
          mode={view}
          hrefFor={hrefFor}
          modes={["calendar", "deck", "grid"]}
          variant="icons"
        />
        <Link
          href={catalogHref("/", { ...query, view, month: nextMonth })}
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
