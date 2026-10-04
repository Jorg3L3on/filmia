"use client";

import { useState, useTransition, type FormEvent } from "react";
import { clearTitleWatched, markTitleWatched } from "@/app/actions/watchlist";
import { Button } from "@/components/Button";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { RatingStars } from "@/components/RatingStars";
import { todayDateInput, toDateInput } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { showToast } from "@/lib/toast";
import { actionErrorMessage } from "@/lib/use-optimistic-action";
import { fieldClass } from "@/lib/ui";

type MarkWatchedFormProps = {
  titleId: string;
  variant?: "hero" | "queue" | "detail";
  watchedAt?: Date | string | null;
  rating?: number | null;
  review?: string | null;
  collapsed?: boolean;
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
  onSaved,
}: MarkWatchedFormProps) => {
  const isCompact = variant === "queue";
  const isEdit = Boolean(watchedAt);
  const defaultDate = toDateInput(watchedAt) || todayDateInput();
  const [noteValue, setNoteValue] = useState<number | null>(rating);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    onSaved?.();
    showToast({ title: isEdit ? "Diario actualizado" : "Marcada como vista" });
    startTransition(async () => {
      try {
        await markTitleWatched(titleId, formData);
      } catch (caught) {
        const message = actionErrorMessage(caught);
        setError(message);
        showToast({ title: "No se pudo guardar", description: message, variant: "error" });
      }
    });
  };

  const handleClear = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await clearTitleWatched(titleId);
      } catch (caught) {
        setError(actionErrorMessage(caught));
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
            className={cn(fieldClass, "[color-scheme:dark]", isCompact && "px-2 py-1 text-xs")}
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
        <form onSubmit={handleClear}>
          <ConfirmSubmit
            label="Quitar del diario"
            confirmMessage="¿Quitar la fecha de visto? Se conservan tu nota y el comentario."
            size={isCompact ? "sm" : "md"}
          />
        </form>
      ) : null}
    </div>
  );

  if (!collapsed) {
    return form;
  }

  return (
    <details className="group rounded-md border border-line bg-well p-2">
      <summary
        className="cursor-pointer list-none text-xs font-medium text-accent [&::-webkit-details-marker]:hidden"
        aria-label={isEdit ? "Editar entrada del diario" : "Marcar como vista"}
        tabIndex={0}
      >
        {isEdit ? "Editar diario" : "Vi esto"}
      </summary>
      <div className="pt-2">{form}</div>
    </details>
  );
};
