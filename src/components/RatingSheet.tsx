"use client";

import { useEffect, useId, useState } from "react";
import { RatingStars } from "@/components/RatingStars";
import { cn } from "@/lib/cn";
import { btnPrimary, fieldClass, focusRing } from "@/lib/ui";

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
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar tu nota"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleDomId}
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line bg-well shadow-[0_-12px_40px_rgba(0,0,0,0.45)] sm:rounded-3xl"
      >
        <div className="flex flex-col items-center px-5 pt-3">
          <span aria-hidden="true" className="mb-3 h-1 w-10 rounded-full bg-chrome" />
          <h2 id={titleDomId} className="font-serif text-3xl text-paper">
            Tu nota
          </h2>
        </div>

        <div className="space-y-5 px-5 py-6">
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

          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className={cn(btnPrimary, "w-full py-3", focusRing)}
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
};
