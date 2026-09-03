import { cn } from "@/lib/cn";

type WatchedBadgeProps = {
  compact?: boolean;
  className?: string;
};

export const WatchedBadge = ({
  compact = false,
  className,
}: WatchedBadgeProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-accent font-semibold uppercase tracking-wider text-ink",
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        className,
      )}
    >
      Visto
    </span>
  );
};
