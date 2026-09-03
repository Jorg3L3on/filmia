import { markTitleWatched } from "@/app/actions/watchlist";
import { btnPrimary, btnSecondary, fieldClass } from "@/lib/ui";

type MarkWatchedFormProps = {
  titleId: string;
  variant?: "hero" | "queue" | "detail";
};

export const MarkWatchedForm = ({
  titleId,
  variant = "detail",
}: MarkWatchedFormProps) => {
  const action = markTitleWatched.bind(null, titleId);
  const isCompact = variant === "queue";

  return (
    <form
      action={action}
      className={
        isCompact
          ? "flex flex-wrap items-center gap-2"
          : "flex flex-wrap items-end gap-2"
      }
    >
      <label className="block space-y-1">
        <span className="sr-only">Tu nota al marcarla vista</span>
        <select
          name="rating"
          defaultValue=""
          aria-label="Tu nota del 1 al 10"
          className={
            isCompact
              ? `${fieldClass} w-auto rounded-full px-3 py-1 text-xs`
              : `${fieldClass} w-auto rounded-full`
          }
        >
          <option value="">Tu nota</option>
          {Array.from({ length: 10 }, (_, index) => {
            const value = index + 1;
            return (
              <option key={value} value={value}>
                {value}/10
              </option>
            );
          })}
        </select>
      </label>
      <button
        type="submit"
        className={isCompact ? `${btnSecondary} px-3 py-1 text-xs` : btnPrimary}
      >
        Ya la vi
      </button>
    </form>
  );
};
