"use client";

import { useId, useState } from "react";
import { Button } from "@/components/Button";
import { RatingStars } from "@/components/RatingStars";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { cn } from "@/lib/cn";
import { fieldClass } from "@/lib/ui";

const NOTE_MAX = 200;

type RatingSheetProps = {
  open: boolean;
  titleId: string;
  rating: number | null;
  review?: string | null;
  pending?: boolean;
  onClose: () => void;
  onSave?: (next: { rating: number | null; review: string }) => void;
};

export const RatingSheet = ({
  open,
  titleId,
  rating,
  review = "",
  pending = false,
  onClose,
  onSave,
}: RatingSheetProps) => {
  if (!open) {
    return null;
  }

  return (
    <RatingSheetFields
      key={`${titleId}:${rating}:${review}`}
      rating={rating}
      review={review}
      pending={pending}
      onClose={onClose}
      onSave={onSave}
    />
  );
};

const RatingSheetFields = ({
  rating,
  review = "",
  pending,
  onClose,
  onSave,
}: Omit<RatingSheetProps, "open" | "titleId">) => {
  const titleDomId = useId();
  const [value, setValue] = useState<number | null>(rating);
  const [note, setNote] = useState(review ?? "");

  const handleSave = () => {
    onSave?.({ rating: value, review: note.trim() });
    if (!onSave) {
      onClose();
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      labelledBy={titleDomId}
      overlayLabel="Cerrar tu nota"
      layer="top"
      dragDismiss
    >
      <div className="flex flex-col items-center px-5 pt-3">
        <SheetHandle />
        <h2 id={titleDomId} className="font-serif text-3xl text-paper">
          Tu nota
        </h2>
      </div>

      <div className="space-y-5 px-5 py-6" data-no-sheet-drag>
        <RatingStars value={value} onChange={setValue} />

        <label className="block space-y-2">
          <span className="sr-only">Nota corta opcional</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, NOTE_MAX))}
            maxLength={NOTE_MAX}
            rows={3}
            placeholder="Escribe una nota corta (opcional)"
            className={cn(fieldClass, "resize-none bg-canvas")}
          />
          <span className="block text-right text-[11px] text-mist" aria-live="polite">
            {note.length}/{NOTE_MAX}
          </span>
        </label>

        <Button
          type="button"
          onClick={handleSave}
          pending={pending}
          pendingLabel="Guardando…"
          className="w-full py-3"
        >
          Guardar
        </Button>
      </div>
    </Sheet>
  );
};
