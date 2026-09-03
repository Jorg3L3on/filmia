"use client";

import { clearTitleWatched, markTitleWatched } from "@/app/actions/watchlist";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { todayDateInput, toDateInput } from "@/lib/dates";
import { cn } from "@/lib/cn";
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  fieldClass,
} from "@/lib/ui";

type MarkWatchedFormProps = {
  titleId: string;
  variant?: "hero" | "queue" | "detail";
  watchedAt?: Date | string | null;
  rating?: number | null;
  review?: string | null;
  collapsed?: boolean;
};

const RATING_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);

const fieldLabel =
  "text-[11px] font-medium uppercase tracking-[0.18em] text-fog";

export const MarkWatchedForm = ({
  titleId,
  variant = "detail",
  watchedAt = null,
  rating = null,
  review = null,
  collapsed = false,
}: MarkWatchedFormProps) => {
  const action = markTitleWatched.bind(null, titleId);
  const clearAction = clearTitleWatched.bind(null, titleId);
  const isCompact = variant === "queue";
  const isEdit = Boolean(watchedAt);
  const defaultDate = toDateInput(watchedAt) || todayDateInput();

  const form = (
    <div className={isCompact ? "w-full space-y-2" : "w-full max-w-xl space-y-3"}>
      <form
        action={action}
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

        <label className="block space-y-1">
          <span className={isCompact ? "sr-only" : fieldLabel}>Tu nota</span>
          <select
            name="rating"
            defaultValue={rating ?? ""}
            aria-label="Tu nota del 1 al 10"
            className={
              isCompact
                ? `${fieldClass} w-auto rounded-full px-3 py-1 text-xs`
                : `${fieldClass} w-auto rounded-full`
            }
          >
            <option value="">Sin nota</option>
            {RATING_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}/10
              </option>
            ))}
          </select>
        </label>

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
          <button
            type="submit"
            className={isCompact ? `${btnSecondary} px-3 py-1 text-xs` : btnPrimary}
          >
            {isEdit ? "Guardar en el diario" : "Vi esto"}
          </button>
        </div>
      </form>

      {isEdit ? (
        <form action={clearAction}>
          <ConfirmSubmit
            label="Quitar del diario"
            confirmMessage="¿Quitar la fecha de visto? Se conservan tu nota y el comentario."
            className={isCompact ? `${btnDanger} px-3 py-1 text-xs` : btnDanger}
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
