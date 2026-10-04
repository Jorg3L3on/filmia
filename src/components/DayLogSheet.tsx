"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import {
  CoverflowDeck,
  type CoverflowTitle,
} from "@/components/CoverflowDeck";
import type { DiaryCalendarTitle } from "@/components/diary-types";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { formatDaySheetParts } from "@/lib/dates";
import { TitleKind } from "@/db";
import { focusRing } from "@/lib/ui";

type DayLogSheetProps = {
  open: boolean;
  isoDate: string | null;
  titles: DiaryCalendarTitle[];
  onClose: () => void;
};

const toCoverflowTitle = (title: DiaryCalendarTitle): CoverflowTitle => ({
  id: title.id,
  name: title.name,
  kind: title.kind ?? TitleKind.MOVIE,
  year: title.year,
  rating: title.rating,
  posterPath: title.posterPath,
  platform: title.platform ?? null,
  imdbRating: title.imdbRating ?? null,
  watched: Boolean(title.watchedAt),
  review: title.review,
  seriesStatus: title.seriesStatus,
  seriesSeason: title.seriesSeason,
});

export const DayLogSheet = ({ open, isoDate, titles, onClose }: DayLogSheetProps) => {
  const titleDomId = useId();
  const [activeTitle, setActiveTitle] = useState<CoverflowTitle | null>(null);
  const [trackedDate, setTrackedDate] = useState(isoDate);
  const deckTitles = useMemo(() => titles.map(toCoverflowTitle), [titles]);
  const parts = isoDate ? formatDaySheetParts(isoDate, titles.length) : null;
  const focused = activeTitle ?? deckTitles[0] ?? null;
  const ready = open && Boolean(isoDate) && Boolean(parts) && titles.length > 0;

  if (isoDate !== trackedDate) {
    setTrackedDate(isoDate);
    setActiveTitle(null);
  }

  return (
    <Sheet
      open={ready}
      onClose={onClose}
      labelledBy={titleDomId}
      overlayLabel="Cerrar"
      align="bottom"
      dragDismiss
      panelClassName="sm:mb-8"
    >
      <div className="flex flex-col items-center px-5 pt-3">
        <SheetHandle />
        <div className="flex w-full items-start justify-between gap-3 pt-1">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
              Ese día
            </p>
            <h2 id={titleDomId} className="min-w-0 font-serif text-xl text-paper sm:text-2xl">
              <span>{parts?.heading}</span>
              <span className="text-accent"> · {parts?.countLabel}</span>
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-9 w-9 shrink-0 px-0"
          >
            <CloseIcon />
          </Button>
        </div>
      </div>

      <div className="px-2 pt-4 sm:px-4">
        <CoverflowDeck
          key={isoDate ?? "day"}
          titles={deckTitles}
          variant="sheet"
          onActiveChange={(_index, title) => setActiveTitle(title)}
        />
      </div>

      {focused ? (
        <div className="px-5 pt-3 pb-1">
          <Button
            href={`/titulos/${focused.id}`}
            onClick={onClose}
            aria-label={`Ver ${focused.name} en diario`}
            className="w-full gap-2"
          >
            Ver ficha
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
};

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path strokeLinecap="round" d="M7 7l10 10M17 7 7 17" />
  </svg>
);

export const daySheetFocusRing = focusRing;
