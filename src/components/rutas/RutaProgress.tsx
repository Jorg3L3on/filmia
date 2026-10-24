import { cn } from "@/lib/cn";

/** One segment per step: seen in green, the next in accent, the rest dim. Decorative; the label says it. */
export const RutaProgress = ({
  done,
  total,
  className,
  highlightNext = true,
}: {
  done: number;
  total: number;
  className?: string;
  highlightNext?: boolean;
}) => (
  <div className={cn("flex items-center gap-1.5", className)} aria-hidden="true">
    {Array.from({ length: total }, (_, index) => (
      <span
        key={index}
        className={cn(
          "h-1 flex-1 rounded-full",
          index < done ? "bg-success" : index === done && highlightNext ? "bg-accent" : "bg-white/12",
        )}
      />
    ))}
  </div>
);
