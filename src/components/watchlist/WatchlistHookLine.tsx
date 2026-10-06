import { ClockIcon, SparkIcon } from "@/components/watchlist/icons";
import { cn } from "@/lib/cn";
import type { WatchlistHook } from "@/lib/watchlist-hook";

type WatchlistHookLineProps = {
  hook: WatchlistHook | null;
  className?: string;
};

/** The one-line «gancho»: accent for reasons, italic serif for the user's note, muted when snoozed. */
export const WatchlistHookLine = ({ hook, className }: WatchlistHookLineProps) => {
  if (!hook) {
    return null;
  }

  if (hook.kind === "note") {
    return (
      <span className={cn("block truncate font-serif text-[12.5px] italic text-paper/85", className)}>
        «{hook.text}»
      </span>
    );
  }

  const muted = hook.kind === "snoozed";
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs",
        muted ? "text-fog" : "text-accent-hover",
        className,
      )}
      title={hook.detail}
    >
      <span className="shrink-0">{muted ? <ClockIcon /> : <SparkIcon />}</span>
      <span className="truncate">{hook.text}</span>
    </span>
  );
};
