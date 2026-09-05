"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { markTitleWatched } from "@/app/actions/watchlist";
import { RatingStars } from "@/components/RatingStars";
import { cn } from "@/lib/cn";
import {
  dateInputForPreset,
  todayDateInput,
  type WatchedDatePreset,
} from "@/lib/dates";
import { useSheetDragDismiss } from "@/lib/motion";
import { btnGhost, btnPrimary, fieldClass, focusRing } from "@/lib/ui";

const NOTE_MAX = 200;

const DATE_PRESETS: { id: WatchedDatePreset; label: string }[] = [
  { id: "today", label: "Hoy" },
  { id: "yesterday", label: "Ayer" },
  { id: "custom", label: "Elegir fecha" },
];

type MarkWatchedSheetProps = {
  open: boolean;
  titleId: string;
  titleName: string;
  rating?: number | null;
  review?: string | null;
  onClose: () => void;
};

export const MarkWatchedSheet = ({
  open,
  titleId,
  titleName,
  rating = null,
  review = "",
  onClose,
}: MarkWatchedSheetProps) => {
  const titleDomId = useId();
  const { sheetStyle, dragHandlers } = useSheetDragDismiss(onClose);
  const [datePreset, setDatePreset] = useState<WatchedDatePreset>("today");
  const [watchedAt, setWatchedAt] = useState(todayDateInput());
  const [value, setValue] = useState<number | null>(rating);
  const [note, setNote] = useState((review ?? "").slice(0, NOTE_MAX));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }

    setDatePreset("today");
    setWatchedAt(todayDateInput());
    setValue(rating);
    setNote((review ?? "").slice(0, NOTE_MAX));
    setError(null);
  }, [open, rating, review]);

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

  const handlePreset = (preset: WatchedDatePreset) => {
    setDatePreset(preset);
    setError(null);
    if (preset !== "custom") {
      setWatchedAt(dateInputForPreset(preset));
    }
  };

  const handleCustomDate = (next: string) => {
    setDatePreset("custom");
    setWatchedAt(next);
    setError(null);
  };

  const handleSave = () => {
    if (!watchedAt) {
      setError("Elige una fecha.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("watchedAt", watchedAt);
        if (value != null) {
          formData.set("rating", String(value));
        }
        formData.set("review", note.trim());
        await markTitleWatched(titleId, formData);
        onClose();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "No se pudo guardar.",
        );
      }
    });
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar Marqué visto"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleDomId}
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line bg-well pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.45)] sm:mb-0 sm:rounded-3xl"
        style={sheetStyle}
        {...dragHandlers}
      >
        <div className="flex flex-col items-center px-5 pt-3">
          <span aria-hidden="true" className="mb-3 h-1 w-10 rounded-full bg-chrome sm:hidden" />
          <div className="flex w-full items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h2 id={titleDomId} className="font-serif text-3xl text-paper">
                Marqué visto
              </h2>
              <p className="truncate text-sm font-medium text-accent">
                <span aria-hidden="true">• </span>
                {titleName}
              </p>
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

        <div className="space-y-5 px-5 py-6" data-no-sheet-drag>
          <fieldset className="space-y-2">
            <legend className="text-[11px] font-medium uppercase tracking-[0.18em] text-fog">
              Fecha
            </legend>
            <div
              role="radiogroup"
              aria-label="Fecha en que la viste"
              className="grid grid-cols-3 gap-1 rounded-full bg-canvas p-1"
            >
              {DATE_PRESETS.map((preset) => {
                const selected = datePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handlePreset(preset.id)}
                    className={cn(
                      "rounded-full px-2 py-2 text-center text-xs font-medium transition sm:text-sm",
                      focusRing,
                      selected
                        ? "bg-accent text-ink"
                        : "text-fog hover:text-paper",
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            {datePreset === "custom" ? (
              <label className="block space-y-1">
                <span className="sr-only">Elegir fecha</span>
                <input
                  type="date"
                  value={watchedAt}
                  onChange={(event) => handleCustomDate(event.target.value)}
                  required
                  aria-label="Fecha en que la viste"
                  className={cn(fieldClass, "bg-canvas [color-scheme:dark]")}
                />
              </label>
            ) : null}
          </fieldset>

          <div className="space-y-2">
            <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-fog">
              Tu nota
            </p>
            <RatingStars value={value} onChange={setValue} />
          </div>

          <label className="block space-y-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-fog">
              Nota
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, NOTE_MAX))}
              maxLength={NOTE_MAX}
              rows={3}
              placeholder="Una línea, un spoiler, un veredicto…"
              className={cn(fieldClass, "resize-none bg-canvas")}
            />
            <span className="block text-right text-[11px] text-mist" aria-live="polite">
              {note.length}/{NOTE_MAX}
            </span>
          </label>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className={cn(btnGhost, "w-full py-3 sm:w-auto sm:px-5")}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className={cn(btnPrimary, "w-full flex-1 py-3", focusRing)}
            >
              {isPending ? "Guardando…" : "Guardar y quitar de Quiero ver"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    aria-hidden="true"
  >
    <path strokeLinecap="round" d="M7 7l10 10M17 7 7 17" />
  </svg>
);
