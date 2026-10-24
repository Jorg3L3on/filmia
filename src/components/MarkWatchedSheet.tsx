"use client";

import { useId, useState, useTransition } from "react";
import { markTitleWatched } from "@/app/actions/watchlist";
import { Button } from "@/components/Button";
import { PlatformChips } from "@/components/PlatformChips";
import { RatingStars } from "@/components/RatingStars";
import { Sheet, SheetHandle, useOpenGeneration } from "@/components/Sheet";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import {
  dateInputForPreset,
  todayDateInput,
  type WatchedDatePreset,
} from "@/lib/dates";
import { PLATFORM_LABEL } from "@/lib/labels";
import { WATCHLIST_SAVE_LABEL } from "@/lib/mark-seen";
import { showToast } from "@/lib/toast";
import { TOAST_COPY, toastPoster } from "@/lib/toast-alerts";
import { fieldClass, focusRing } from "@/lib/ui";

const NOTE_MAX = 200;

/** What the folded «Más detalles» row holds: «Hoy · Netflix · nota». */
const detailsSummary = (
  preset: WatchedDatePreset,
  watchedAt: string,
  platform: Platform | "",
  note: string,
) => {
  const parts = [
    preset === "today" ? "Hoy" : preset === "yesterday" ? "Ayer" : watchedAt,
    platform ? PLATFORM_LABEL[platform] : null,
    note.trim() ? "nota" : null,
  ].filter(Boolean);
  return parts.join(" · ");
};

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={cn("transition-transform duration-[var(--duration-hover)]", open && "rotate-180")}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const DATE_PRESETS: { id: WatchedDatePreset; label: string }[] = [
  { id: "today", label: "Hoy" },
  { id: "yesterday", label: "Ayer" },
  { id: "custom", label: "Elegir fecha" },
];

type MarkWatchedSheetProps = {
  open: boolean;
  titleId: string;
  titleName: string;
  /** Prefill date (YYYY-MM-DD) when editing an existing diario entry. */
  initialWatchedAt?: string | null;
  rating?: number | null;
  review?: string | null;
  /**
   * Saved «Dónde la vi». `undefined` = the caller doesn't know it (deck, sala,
   * Quiero ver): the field is only sent when the user taps a chip, so a saved
   * platform is never wiped by a caller that couldn't prefill it.
   */
  platform?: Platform | null;
  saveLabel?: string;
  /** Skip the generic «Marcada como vista» toast (the caller shows its own). */
  silent?: boolean;
  posterPath?: string | null;
  /**
   * The mazo already toasts `onWatchError`. Leaving this false avoids a second
   * error toast on top of that one. Other callers keep the toast: the sheet
   * has already closed, so the inline error would not be on screen.
   */
  toastOnError?: boolean;
  onClose: () => void;
  /** Called with the YYYY-MM-DD the user just confirmed, before the write settles. */
  onSaved?: (watchedAt: string) => void;
  onError?: (message: string) => void;
  /**
   * Replaces `markTitleWatched(titleId, …)`: the ficha preview (FIL-I8) has no
   * Title yet and creates it watched with the same form. Throw to report.
   */
  submit?: (formData: FormData) => Promise<void>;
};

export const MarkWatchedSheet = ({
  open,
  titleId,
  titleName,
  initialWatchedAt = null,
  rating = null,
  review = "",
  platform,
  saveLabel = WATCHLIST_SAVE_LABEL,
  silent = false,
  posterPath = null,
  toastOnError = true,
  onClose,
  onSaved,
  onError,
  submit,
}: MarkWatchedSheetProps) => {
  const generation = useOpenGeneration(open);

  return (
    <MarkWatchedSheetFields
      key={`${generation}:${titleId}:${initialWatchedAt}:${rating}:${review}:${platform ?? "?"}`}
      open={open}
      titleId={titleId}
      titleName={titleName}
      initialWatchedAt={initialWatchedAt}
      rating={rating}
      review={review}
      platform={platform}
      saveLabel={saveLabel}
      silent={silent}
      posterPath={posterPath}
      toastOnError={toastOnError}
      onClose={onClose}
      onSaved={onSaved}
      onError={onError}
      submit={submit}
    />
  );
};

const MarkWatchedSheetFields = ({
  open,
  titleId,
  titleName,
  initialWatchedAt = null,
  rating = null,
  review = "",
  platform,
  saveLabel = WATCHLIST_SAVE_LABEL,
  silent = false,
  posterPath = null,
  toastOnError = true,
  onClose,
  onSaved,
  onError,
  submit,
}: MarkWatchedSheetProps) => {
  const poster = toastPoster(posterPath);
  const titleDomId = useId();
  const hasInitialDate = Boolean(initialWatchedAt);
  const [datePreset, setDatePreset] = useState<WatchedDatePreset>(
    hasInitialDate ? "custom" : "today",
  );
  const [watchedAt, setWatchedAt] = useState(
    initialWatchedAt || todayDateInput(),
  );
  const [value, setValue] = useState<number | null>(rating);
  const [note, setNote] = useState((review ?? "").slice(0, NOTE_MAX));
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | "">(platform ?? "");
  const [platformDirty, setPlatformDirty] = useState(false);
  // Stars and Guardar first (FIL-I21-8); Fecha, Dónde la vi and Nota fold under «Más detalles»,
  // open from the start when there is already a note or the date is not today.
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean((review ?? "").trim()) || (hasInitialDate && initialWatchedAt !== todayDateInput()),
  );
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
    onSaved?.(watchedAt);
    if (!silent) {
      showToast({
        title: hasInitialDate ? TOAST_COPY.diaryUpdated : TOAST_COPY.markedSeen,
        description: titleName,
        poster,
      });
    }
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("watchedAt", watchedAt);
        if (value != null) {
          formData.set("rating", String(value));
        }
        formData.set("review", note.trim());
        if (platform !== undefined || platformDirty) {
          // "" = Ninguna → null server-side (parsePlatform).
          formData.set("platform", selectedPlatform);
        }
        if (submit) {
          await submit(formData);
        } else {
          await markTitleWatched(titleId, formData);
        }
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "No se pudo guardar.";
        onError?.(message);
        if (toastOnError) {
          showToast({
            title: TOAST_COPY.couldNotSave,
            description: message,
            variant: "error",
            poster,
          });
        }
      }
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledBy={titleDomId}
      overlayLabel="Cerrar Marqué visto"
      layer="top"
      dragDismiss
      portal
    >
      <div className="flex flex-col items-center px-5 pt-3">
        <SheetHandle className="sm:hidden" />
        <div className="flex w-full items-start gap-3">
          <h2
            id={titleDomId}
            className="min-w-0 line-clamp-2 text-balance pt-1 font-serif text-[1.75rem] leading-[1.1] tracking-tight text-paper"
          >
            <span className="sr-only">Marqué visto: </span>
            {titleName}
          </h2>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5"
        data-no-sheet-drag
      >
        <div className="space-y-2">
          <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-fog">
            Tu nota
          </p>
          <RatingStars value={value} onChange={setValue} />
        </div>

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

        <button
          type="button"
          aria-expanded={detailsOpen}
          aria-controls={`${titleDomId}-details`}
          onClick={() => setDetailsOpen((current) => !current)}
          className={cn(
            "flex w-full items-center justify-between rounded-xl px-1 py-2 text-left text-sm font-medium text-fog hover:text-paper",
            focusRing,
          )}
        >
          <span>Más detalles</span>
          <span className="flex items-center gap-2 text-xs font-normal text-mist">
            {!detailsOpen ? detailsSummary(datePreset, watchedAt, selectedPlatform, note) : null}
            <ChevronIcon open={detailsOpen} />
          </span>
        </button>

        {detailsOpen ? (
          <div id={`${titleDomId}-details`} className="space-y-5">
            <fieldset className="min-w-0 space-y-2">
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
                <label className="block min-w-0 space-y-1">
                  <span className="sr-only">Elegir fecha</span>
                  <input
                    type="date"
                    value={watchedAt}
                    onChange={(event) => handleCustomDate(event.target.value)}
                    required
                    aria-label="Fecha en que la viste"
                    className={cn(fieldClass, "date-field bg-canvas")}
                  />
                </label>
              ) : null}
            </fieldset>

            <PlatformChips
              value={selectedPlatform}
              onChange={(next) => {
                setSelectedPlatform(next);
                setPlatformDirty(true);
              }}
              hint="Solo para tu registro. Dónde verla hoy se actualiza sola."
            />

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
          </div>
        ) : null}
      </div>
    </Sheet>
  );
};

