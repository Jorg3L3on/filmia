"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import {
  CoverflowDeck,
  type CoverflowTitle,
} from "@/components/CoverflowDeck";
import type { DiaryCalendarTitle } from "@/components/diary-types";
import { cn } from "@/lib/cn";
import { formatDaySheetParts } from "@/lib/dates";
import { useSheetDragDismiss } from "@/lib/motion";
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
  const { sheetStyle, dragHandlers } = useSheetDragDismiss(onClose);
  const deckTitles = useMemo(() => titles.map(toCoverflowTitle), [titles]);
  const parts = isoDate ? formatDaySheetParts(isoDate, titles.length) : null;
  const focused = activeTitle ?? deckTitles[0] ?? null;

  useEffect(() => {
    if (!open) {
      setActiveTitle(null);
    }
  }, [open, isoDate]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !isoDate || !parts || titles.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-canvas-deep/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleDomId}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-[28px] bg-well pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-16px_48px_rgba(0,0,0,0.55)] sheet-rise sm:mb-8 sm:rounded-[28px]"
        style={sheetStyle}
        {...dragHandlers}
      >
        <div className="flex flex-col items-center px-5 pt-3">
          <span aria-hidden="true" className="mb-3 h-1 w-10 rounded-full bg-chrome" />
          <div className="flex w-full items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <SparkIcon />
              <h2 id={titleDomId} className="min-w-0 font-serif text-xl text-paper sm:text-2xl">
                <span>{parts.heading}</span>
                <span className="text-accent"> · {parts.countLabel}</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-chrome text-fog hover:text-paper",
                focusRing,
              )}
              aria-label="Cerrar"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="px-2 pt-5 sm:px-4">
          <CoverflowDeck
            key={isoDate}
            titles={deckTitles}
            variant="sheet"
            onActiveChange={(_index, title) => setActiveTitle(title)}
          />
        </div>

        {focused ? (
          <div className="px-5 pt-4">
            <Link
              href={`/titulos/${focused.id}`}
              onClick={onClose}
              aria-label={`Ver ${focused.name} en diario`}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-2xl border border-accent px-4 py-3.5 text-sm font-medium text-paper",
                focusRing,
              )}
            >
              <span className="flex items-center gap-2.5">
                <DiaryIcon />
                Ver ficha
              </span>
              <ChevronIcon />
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const SparkIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4 shrink-0 text-accent"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 2.2 13.7 10.3 21.8 12 13.7 13.7 12 21.8 10.3 13.7 2.2 12 10.3 10.3 12 2.2Z" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path strokeLinecap="round" d="M7 7l10 10M17 7 7 17" />
  </svg>
);

const DiaryIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 5.25h5.25A1.75 1.75 0 0 1 13 7v12.25H7.75A1.75 1.75 0 0 1 6 17.5V5.25Z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 7h4.25A1.75 1.75 0 0 1 19 8.75V19.25H13"
    />
    <path strokeLinecap="round" d="M8.25 8.75h2.5M8.25 11.5h2.5" />
  </svg>
);

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 6 15.5 12l-6 6" />
  </svg>
);

export const daySheetFocusRing = focusRing;
