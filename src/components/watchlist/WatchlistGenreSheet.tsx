"use client";

import { useId, useState } from "react";
import { catalogSheetChipClass } from "@/components/catalog-filters/filter-ui";
import { Sheet, SheetHandle, useOpenGeneration } from "@/components/Sheet";
import { cn } from "@/lib/cn";
import { pillActionClass } from "@/lib/ui";
import type { WatchlistGenreCount } from "@/lib/watchlist-filters";

type WatchlistGenreSheetProps = {
  open: boolean;
  genres: WatchlistGenreCount[];
  selected: number[];
  onClose: () => void;
  onApply: (ids: number[]) => void;
};

/** «Género»: the genres present in the list, with counts, multi-select (OR). */
export const WatchlistGenreSheet = ({ open, genres, selected, onClose, onApply }: WatchlistGenreSheetProps) => {
  const headingId = useId();
  const generation = useOpenGeneration(open);

  return (
    <Sheet open={open} onClose={onClose} labelledBy={headingId} overlayLabel="Cerrar géneros" align="bottom" dragDismiss portal>
      <GenrePicker key={generation} genres={genres} selected={selected} headingId={headingId} onApply={onApply} />
    </Sheet>
  );
};

/** Keyed per open so the draft starts from what is applied, without effects. */
const GenrePicker = ({
  genres,
  selected,
  headingId,
  onApply,
}: {
  genres: WatchlistGenreCount[];
  selected: number[];
  headingId: string;
  onApply: (ids: number[]) => void;
}) => {
  const [draft, setDraft] = useState<number[]>(selected);
  const toggle = (id: number) =>
    setDraft((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <>
      <div className="flex flex-col items-center px-5 pt-3">
        <SheetHandle />
        <h2 id={headingId} className="w-full font-serif text-2xl text-paper">
          Género
        </h2>
        <p className="w-full text-sm text-fog">Los que hay en tu lista. Elige varios.</p>
      </div>
      <ul className="flex flex-wrap gap-2 px-5 py-4" data-no-sheet-drag>
        {genres.map((genre) => {
          const isSelected = draft.includes(genre.id);
          return (
            <li key={genre.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggle(genre.id)}
                className={catalogSheetChipClass(isSelected)}
              >
                {genre.name}
                <span className={cn("text-xs", isSelected ? "text-paper/70" : "text-mist")}>{genre.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-2 px-5 pb-2">
        <button type="button" onClick={() => onApply(draft)} className={cn(pillActionClass.primary, "h-11 flex-1 justify-center")}>
          Aplicar
        </button>
        <button type="button" onClick={() => onApply([])} className={cn(pillActionClass.neutral, "h-11 justify-center")}>
          Limpiar
        </button>
      </div>
    </>
  );
};
