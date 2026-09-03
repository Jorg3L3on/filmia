import { cn } from "@/lib/cn";

type PosterRailProps = {
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
};

export const PosterRail = ({ ariaLabel, children, className }: PosterRailProps) => {
  return (
    <div
      role="list"
      aria-label={ariaLabel}
      className={cn(
        "rail -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 touch-pan-x",
        className,
      )}
    >
      {children}
    </div>
  );
};
