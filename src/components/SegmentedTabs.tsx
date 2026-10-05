import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { auraPillClass, focusRing, glassPanelClass } from "@/lib/ui";

export type SegmentedTab = {
  key: string;
  href: string;
  label: string;
  icon?: ReactNode;
  /** Optional count bubble (accent when > 0). */
  count?: number;
};

type SegmentedTabsProps = {
  items: readonly SegmentedTab[];
  activeKey: string;
  "aria-label": string;
  className?: string;
};

/**
 * Glass segmented tabs (ported from MiCasa): frosted capsule, equal-width link
 * tabs, accent-aura pill that slides to the active tab. Server-safe — the pill
 * is positioned with CSS from the active index, no measuring.
 */
export const SegmentedTabs = ({
  items,
  activeKey,
  "aria-label": ariaLabel,
  className,
}: SegmentedTabsProps) => {
  const activeIndex = items.findIndex((item) => item.key === activeKey);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(glassPanelClass, "flex min-w-0 rounded-full p-1", className)}
    >
      <span
        aria-hidden
        className={cn(
          auraPillClass,
          "segment-indicator pointer-events-none absolute inset-y-1 left-1",
          activeIndex === -1 && "opacity-0",
        )}
        style={{
          width: `calc((100% - 0.5rem) / ${items.length})`,
          transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
        }}
      />
      {items.map((item) => {
        const selected = item.key === activeKey;

        return (
          <Link
            key={item.key}
            href={item.href}
            role="tab"
            aria-selected={selected}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "tab-transition press-scale relative z-10 inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium sm:min-h-9",
              focusRing,
              selected ? "text-paper" : "text-fog hover:text-paper",
            )}
          >
            {item.icon ? (
              <span className="inline-flex shrink-0 [&_svg]:size-3.5">{item.icon}</span>
            ) : null}
            <span className="truncate">{item.label}</span>
            {item.count !== undefined ? (
              <span
                className={cn(
                  "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums leading-none",
                  item.count > 0 ? "bg-accent text-ink" : "bg-white/12 text-paper",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
};
