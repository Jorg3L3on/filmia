"use client";

import Link from "next/link";
import { clearTitleWatched } from "@/app/actions/watchlist";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { PersonalRating } from "@/components/PersonalRating";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { btnDanger, btnGhost, btnPrimary, focusRing } from "@/lib/ui";
import type { DiaryCalendarTitle } from "@/components/diary-types";

type DayLogSheetProps = {
  open: boolean;
  label: string;
  titles: DiaryCalendarTitle[];
  onClose: () => void;
};

export const DayLogSheet = ({ open, label, titles, onClose }: DayLogSheetProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Entradas del ${label}`}
        className="relative z-10 w-full max-w-md rounded-t-2xl border border-line bg-surface p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] sm:rounded-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
              Diario
            </p>
            <h2 className="font-serif text-xl text-paper">{label}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(btnGhost, "px-3 py-1 text-xs")}
          >
            Cerrar
          </button>
        </div>
        <ul className="space-y-3">
          {titles.map((title) => {
            const clearAction = clearTitleWatched.bind(null, title.id);

            return (
              <li
                key={title.id}
                className="rounded-2xl border border-line bg-well p-3"
              >
                <div className="flex gap-3">
                  <span className="block w-12 shrink-0">
                    <PosterImage
                      name={title.name}
                      posterPath={title.posterPath}
                      sizes="48px"
                      className="overflow-hidden rounded-poster"
                    />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-serif text-base text-paper">
                      {title.name}
                    </p>
                    <PersonalRating rating={title.rating} size="sm" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/titulos/${title.id}`}
                    className={`${btnPrimary} px-3 py-1.5 text-xs`}
                    onClick={onClose}
                  >
                    Ver
                  </Link>
                  <Link
                    href={`/titulos/${title.id}/editar`}
                    className={`${btnGhost} px-3 py-1.5 text-xs`}
                    onClick={onClose}
                  >
                    Editar
                  </Link>
                  <form action={clearAction}>
                    <ConfirmSubmit
                      label="Quitar"
                      confirmMessage={`¿Quitar “${title.name}” del diario?`}
                      className={`${btnDanger} px-3 py-1.5 text-xs`}
                    />
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export const daySheetFocusRing = focusRing;
