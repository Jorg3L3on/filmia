"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { clearTitleWatched, markTitleWatched, restoreTitleWatched } from "@/app/actions/watchlist";
import { Button } from "@/components/Button";
import { RatingStars } from "@/components/RatingStars";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { todayDateInput, toDateInput } from "@/lib/dates";
import { showDiaryRemovedToast } from "@/lib/diary-undo";
import { cn } from "@/lib/cn";
import { showToast } from "@/lib/toast";
import { showActionError, TOAST_COPY, toastPoster } from "@/lib/toast-alerts";
import { actionErrorMessage } from "@/lib/use-optimistic-action";
import { fieldClass } from "@/lib/ui";

type MarkWatchedFormProps = {
  titleId: string;
  variant?: "hero" | "queue" | "detail";
  watchedAt?: Date | string | null;
  rating?: number | null;
  review?: string | null;
  collapsed?: boolean;
  posterPath?: string | null;
  onSaved?: () => void;
};

const fieldLabel =
  "text-[11px] font-medium uppercase tracking-[0.18em] text-fog";

export const MarkWatchedForm = ({
  titleId,
  variant = "detail",
  watchedAt = null,
  rating = null,
  review = null,
  collapsed = false,
  posterPath = null,
  onSaved,
}: MarkWatchedFormProps) => {
  // Collapsed lives in a sheet, which has room for the full-size fields.
  const isCompact = variant === "queue" && !collapsed;
  const isEdit = Boolean(watchedAt);
  const defaultDate = toDateInput(watchedAt) || todayDateInput();
  const [noteValue, setNoteValue] = useState<number | null>(rating);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const headingId = useId();
  const poster = toastPoster(posterPath);

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setSheetOpen(false);
    onSaved?.();
    showToast({
      title: isEdit ? TOAST_COPY.diaryUpdated : TOAST_COPY.markedSeen,
      poster,
    });
    startTransition(async () => {
      try {
        await markTitleWatched(titleId, formData);
      } catch (caught) {
        const message = actionErrorMessage(caught);
        setError(message);
        showActionError({
          title: TOAST_COPY.couldNotSave,
          description: message,
          poster,
          retry: () => markTitleWatched(titleId, formData),
        });
      }
    });
  };

  const handleClear = () => {
    const isoDate = toDateInput(watchedAt);
    setError(null);
    const clear = clearTitleWatched(titleId);
    showDiaryRemovedToast({
      clear,
      restore: () => restoreTitleWatched(titleId, isoDate),
      poster,
    });
    startTransition(async () => {
      try {
        await clear;
      } catch (caught) {
        const message = actionErrorMessage(caught);
        setError(message);
        showActionError({
          title: TOAST_COPY.couldNotRemove,
          description: message,
          poster,
          retry: async () => {
            await clearTitleWatched(titleId);
            showDiaryRemovedToast({
              clear: Promise.resolve(),
              restore: () => restoreTitleWatched(titleId, isoDate),
              poster,
            });
          },
        });
      }
    });
  };

  const form = (
    <div className={isCompact ? "w-full space-y-2" : "w-full max-w-xl space-y-3"}>
      <form
        onSubmit={handleSave}
        className={
          isCompact
            ? "grid gap-2 sm:grid-cols-[minmax(0,9.5rem)_auto] sm:items-end"
            : "space-y-3"
        }
      >
        <label className="block min-w-0 space-y-1">
          <span className={isCompact ? "sr-only" : fieldLabel}>Vista el</span>
          <input
            type="date"
            name="watchedAt"
            defaultValue={defaultDate}
            required
            aria-label="Fecha en que la viste"
            className={cn(fieldClass, "date-field", isCompact && "px-2 py-1 text-xs")}
          />
        </label>

        <div className="block space-y-1">
          <span className={isCompact ? "sr-only" : fieldLabel}>Tu nota</span>
          <RatingStars
            value={noteValue}
            onChange={setNoteValue}
            size={isCompact ? "md" : "lg"}
            showValue={!isCompact}
          />
          <input type="hidden" name="rating" value={noteValue ?? ""} />
        </div>

        <label className={isCompact ? "block space-y-1 sm:col-span-2" : "block space-y-1"}>
          <span className={isCompact ? "sr-only" : fieldLabel}>Nota corta</span>
          <textarea
            name="review"
            rows={isCompact ? 2 : 3}
            maxLength={1000}
            defaultValue={review ?? ""}
            placeholder="Una línea, un spoiler, un veredicto…"
            aria-label="Nota corta opcional"
            className={cn(fieldClass, isCompact && "px-2 py-1 text-xs")}
          />
        </label>

        <div className={isCompact ? "sm:col-span-2" : undefined}>
          <Button
            type="submit"
            pending={isPending}
            pendingLabel="Guardando…"
            variant={isCompact ? "secondary" : "primary"}
            size={isCompact ? "sm" : "md"}
          >
            {isEdit ? "Guardar en el diario" : "Vi esto"}
          </Button>
        </div>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {isEdit ? (
        <Button
          type="button"
          variant="danger"
          size={isCompact ? "sm" : "md"}
          onClick={handleClear}
        >
          Quitar del diario
        </Button>
      ) : null}
    </div>
  );

  if (!collapsed) {
    return form;
  }

  const triggerLabel = isEdit ? "Editar diario" : "Vi esto";

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setSheetOpen(true)}
        aria-label={isEdit ? "Editar entrada del diario" : "Marcar como vista"}
        aria-haspopup="dialog"
      >
        {triggerLabel}
      </Button>
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        labelledBy={headingId}
        overlayLabel="Cerrar"
        align="bottom"
        dragDismiss
        portal
      >
        <div className="flex flex-col items-center px-5 pt-3">
          <SheetHandle />
          <h2 id={headingId} className="w-full font-serif text-xl text-paper">
            {isEdit ? "Editar diario" : "Vi esto"}
          </h2>
        </div>
        <div className="px-5 pb-5 pt-4 text-left" data-no-sheet-drag>
          {form}
        </div>
      </Sheet>
    </>
  );
};
