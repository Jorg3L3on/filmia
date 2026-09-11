import { cn } from "@/lib/cn";
import type { CoverflowTitle } from "@/components/coverflow/types";

type CoverflowIndicatorsProps = {
  titles: readonly CoverflowTitle[];
  activeIndex: number;
};

/** Presentational page-mode dots — no client hooks. */
export const CoverflowIndicators = ({
  titles,
  activeIndex,
}: CoverflowIndicatorsProps) => (
  <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
    {titles.map((title, index) => (
      <span
        key={title.id}
        className={cn(
          "h-1.5 rounded-full",
          index === activeIndex ? "w-4 bg-accent" : "w-1.5 bg-chrome",
        )}
      />
    ))}
  </div>
);
