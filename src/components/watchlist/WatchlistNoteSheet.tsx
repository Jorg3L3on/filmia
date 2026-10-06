"use client";

import { useId, useState } from "react";
import { Sheet, SheetHandle } from "@/components/Sheet";
import type { FichaView } from "@/components/watchlist/types";
import { cn } from "@/lib/cn";
import { fieldClass, pillActionClass } from "@/lib/ui";

export const QUEUE_NOTE_MAX = 120;

type WatchlistNoteSheetProps = {
  ficha: FichaView | null;
  onClose: () => void;
  onSave: (ficha: FichaView, note: string) => void;
};

/** «Anotar por qué la quiero ver»: the queue note shown in italics on the ficha. */
export const WatchlistNoteSheet = ({ ficha, onClose, onSave }: WatchlistNoteSheetProps) => {
  const headingId = useId();
  return (
    <Sheet
      open={Boolean(ficha)}
      onClose={onClose}
      labelledBy={headingId}
      overlayLabel="Cerrar nota"
      align="bottom"
      dragDismiss
      portal
    >
      {ficha ? <NoteForm key={ficha.id} ficha={ficha} headingId={headingId} onSave={onSave} /> : null}
    </Sheet>
  );
};

/** Keyed by ficha so the draft resets per title without effects. */
const NoteForm = ({
  ficha,
  headingId,
  onSave,
}: {
  ficha: FichaView;
  headingId: string;
  onSave: (ficha: FichaView, note: string) => void;
}) => {
  const fieldId = useId();
  const [note, setNote] = useState(ficha.queueNote ?? "");

  return (
    <form
      className="flex flex-col gap-4 px-5 pb-2 pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(ficha, note.trim());
      }}
    >
      <div className="flex flex-col items-center">
        <SheetHandle />
        <h2 id={headingId} className="w-full font-serif text-2xl text-paper">
          ¿Por qué la quieres ver?
        </h2>
        <p className="w-full text-sm text-fog">{ficha.name}</p>
      </div>
      <div data-no-sheet-drag>
        <label htmlFor={fieldId} className="sr-only">
          Tu nota
        </label>
        <textarea
          id={fieldId}
          value={note}
          maxLength={QUEUE_NOTE_MAX}
          rows={3}
          autoFocus
          placeholder="Para un domingo largo. · Me la recomendó Ana. · Revisar la fotografía."
          onChange={(event) => setNote(event.target.value)}
          className={cn(fieldClass, "min-h-24 resize-none font-serif text-base italic")}
        />
        <p className="mt-1 text-right text-[11px] text-mist">
          {note.length}/{QUEUE_NOTE_MAX}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" className={cn(pillActionClass.primary, "h-11 flex-1 justify-center")}>
          Guardar
        </button>
        {ficha.queueNote ? (
          <button
            type="button"
            onClick={() => onSave(ficha, "")}
            className={cn(pillActionClass.neutral, "h-11 justify-center")}
          >
            Quitar nota
          </button>
        ) : null}
      </div>
    </form>
  );
};
