import type { SeriesStatus } from "@/generated/prisma/browser";
import { cn } from "@/lib/cn";
import { SERIES_STATUS_CLASS, SERIES_STATUS_LABEL } from "@/lib/labels";

type SeriesStatusBadgeProps = {
  status: SeriesStatus | null | undefined;
  compact?: boolean;
  className?: string;
};

export const SeriesStatusBadge = ({
  status,
  compact = false,
  className,
}: SeriesStatusBadgeProps) => {
  if (!status) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold uppercase tracking-wider",
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        SERIES_STATUS_CLASS[status],
        className,
      )}
    >
      {SERIES_STATUS_LABEL[status]}
    </span>
  );
};
