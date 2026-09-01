import { markTitleWatched } from "@/app/actions/watchlist";

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
              ? "rounded-full border border-[#2c3440] bg-[#0a0a0a] px-3 py-1 text-xs text-white focus:border-[#00e054] focus:outline-none"
              : "rounded-full border border-[#2c3440] bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:border-[#00e054] focus:outline-none"
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
        className={
          variant === "hero"
            ? "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#2563eb] via-[#7c3aed] to-[#db2777] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            : variant === "queue"
              ? "inline-flex items-center gap-1.5 rounded-full bg-[#1a1a2e] px-3 py-1 text-xs text-[#c4b5fd] hover:bg-[#7c3aed]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b5cf6]"
              : "inline-flex items-center gap-2 rounded-full bg-[#00e054] px-4 py-2 text-sm font-semibold text-[#14181c] hover:bg-[#00c030] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        }
      >
        Ya la vi
      </button>
    </form>
  );
};
