import Link from "next/link";
import {
  DeckViewToggle,
  type DeckViewMode,
} from "@/components/DeckViewToggle";
import { DIARY_VIEW_MODES, HISTORIAL_DEFAULT_VIEW } from "@/lib/diary-view";
import { cn } from "@/lib/cn";
import { formatMonthHeading, monthCountSuffix, shiftMonthParam } from "@/lib/dates";
import type { CatalogKindFilter } from "@/lib/catalog-href";
import { catalogHref } from "@/lib/catalog-href";
import { focusRing } from "@/lib/ui";
import type { Platform } from "@/db";
import type { SeriesStatusFilter } from "@/lib/series";
import type { CatalogSort } from "@/lib/catalog-href";

type DiaryViewHeaderProps = {
  /** Route that owns the month navigation (Tu diario lives at /diario). */
  pathname?: string;
  month: string;
  view: DeckViewMode;
  hrefFor: (mode: DeckViewMode) => string;
  countLabel?: string;
  minePlatforms?: boolean;
  seriesStatus?: SeriesStatusFilter;
  kind?: CatalogKindFilter;
  platforms?: Platform[];
  sort?: CatalogSort | null;
};

export const DiaryViewHeader = ({
  pathname = "/diario",
  month,
  view,
  hrefFor,
  countLabel,
  minePlatforms = false,
  seriesStatus,
  kind,
  platforms,
  sort,
}: DiaryViewHeaderProps) => {
  const query = {
    minePlatforms,
    seriesStatus,
    defaultView: HISTORIAL_DEFAULT_VIEW,
    kind,
    platforms,
    sort,
  };
  const prevMonth = shiftMonthParam(month, -1);
  const nextMonth = shiftMonthParam(month, 1);

  // Two rows (FIL-I44-10): the month always fits on one line between its arrows; the count and
  // the view switch share the second row instead of squeezing the month into two lines.
  const monthNavClass = cn(
    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fog hover:bg-well hover:text-paper",
    focusRing,
  );

  return (
    <header className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={catalogHref(pathname, { ...query, view, month: prevMonth })}
          aria-label={`Mes anterior, ${formatMonthHeading(prevMonth)}`}
          className={monthNavClass}
        >
          <ChevronIcon direction="prev" />
        </Link>
        <h2 className="min-w-0 truncate text-center font-serif text-2xl tracking-tight text-paper first-letter:uppercase sm:text-[1.85rem]">
          {formatMonthHeading(month)}
        </h2>
        <Link
          href={catalogHref(pathname, { ...query, view, month: nextMonth })}
          aria-label={`Mes siguiente, ${formatMonthHeading(nextMonth)}`}
          className={monthNavClass}
        >
          <ChevronIcon direction="next" />
        </Link>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-[11px] uppercase tracking-[0.18em] text-mist">
          {countLabel ? `${countLabel} ${monthCountSuffix(month)}` : null}
        </p>
        <DeckViewToggle mode={view} hrefFor={hrefFor} modes={DIARY_VIEW_MODES} variant="icons" />
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
