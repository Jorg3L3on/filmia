"use client";

import { useId, useState, useTransition } from "react";
import { markTitleWatched } from "@/app/actions/watchlist";
import { Button } from "@/components/Button";
import { RatingStars } from "@/components/RatingStars";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { cn } from "@/lib/cn";
import {
  dateInputForPreset,
  todayDateInput,
  type WatchedDatePreset,
} from "@/lib/dates";
import { WATCHLIST_SAVE_LABEL } from "@/lib/mark-seen";
import { showToast } from "@/lib/toast";
import { fieldClass, focusRing } from "@/lib/ui";

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
  saveLabel?: string;
  onClose: () => void;
  onSaved?: () => void;
  onError?: (message: string) => void;
};

export const MarkWatchedSheet = ({
  open,
  titleId,
  titleName,
  rating = null,
  review = "",
  saveLabel = WATCHLIST_SAVE_LABEL,
  onClose,
  onSaved,
  onError,
}: MarkWatchedSheetProps) => {
  if (!open) {
    return null;
  }

  return (
    <MarkWatchedSheetFields
      key={`${titleId}:${rating}:${review}`}
      titleId={titleId}
      titleName={titleName}
      rating={rating}
      review={review}
      saveLabel={saveLabel}
      onClose={onClose}
      onSaved={onSaved}
      onError={onError}
    />
  );
};

const MarkWatchedSheetFields = ({
  titleId,
  titleName,
  rating = null,
  review = "",
  saveLabel = WATCHLIST_SAVE_LABEL,
  onClose,
  onSaved,
  onError,
}: Omit<MarkWatchedSheetProps, "open">) => {
  const titleDomId = useId();
  const [datePreset, setDatePreset] = useState<WatchedDatePreset>("today");
  const [watchedAt, setWatchedAt] = useState(todayDateInput());
  const [value, setValue] = useState<number | null>(rating);
  const [note, setNote] = useState((review ?? "").slice(0, NOTE_MAX));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

    onClose();
    onSaved?.();
    showToast({
      title: "Marcada como vista",
      description: titleName,
    });
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("watchedAt", watchedAt);
        if (value != null) {
          formData.set("rating", String(value));
        }
        formData.set("review", note.trim());
        await markTitleWatched(titleId, formData);
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "No se pudo guardar.";
        setError(message);
        onError?.(message);
        showToast({ title: "No se pudo guardar", description: message, variant: "error" });
      }
    });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      labelledBy={titleDomId}
      overlayLabel="Cerrar Marqué visto"
      layer="top"
      dragDismiss
      portal
    >
      <div className="flex flex-col items-center px-5 pt-3">
        <SheetHandle className="sm:hidden" />
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
                    selected ? "bg-accent text-ink" : "text-fog hover:text-paper",
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
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="w-full py-3 sm:w-auto sm:px-5"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            pending={isPending}
            pendingLabel="Guardando…"
            className="w-full flex-1 py-3"
          >
            {saveLabel}
          </Button>
        </div>
      </div>
    </Sheet>
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
