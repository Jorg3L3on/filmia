"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ActiveNavLink } from "@/components/ActiveNavLink";
import { BottomNavShell } from "@/components/BottomNavShell";
import { NavIcon } from "@/components/NavIcon";
import { cn } from "@/lib/cn";
import {
  isMobileNavCurrent,
  mobileNavItems,
  mobileNavSearch,
  mobileNavSearchSlot,
} from "@/lib/nav";
import { focusRing, glassIconClass, glassPillClass } from "@/lib/ui";

/** Grid column for a tab: tabs flow around the center Buscar disc. */
const columnFor = (index: number) =>
  index < mobileNavSearchSlot ? index : index + 1;

const subscribeNoop = () => () => {};
const todayDay = () => new Date().getDate();
const noDay = () => null;

/** Day number for the Hoy glyph; null during SSR/hydration so markup matches. */
const useTodayDay = () => useSyncExternalStore(subscribeNoop, todayDay, noDay);

/**
 * Floating glass dock: four tabs + center Buscar disc, sliding glass pill on
 * the active tab. On /buscar no tab matches, so the pill fades and the disc lights.
 */
export const BottomNav = () => {
  const pathname = usePathname();
  const day = useTodayDay();
  const activeIndex = mobileNavItems.findIndex((item) =>
    isMobileNavCurrent(item.href, pathname),
  );
  const activeColumn = activeIndex === -1 ? null : columnFor(activeIndex);

  return (
    <BottomNavShell>
      <div
        data-dock-shell
        className="relative grid h-16 grid-cols-5 items-center rounded-full border border-white/12 bg-[rgb(12_16_24/0.72)] px-1 shadow-panel backdrop-blur-2xl backdrop-saturate-180 supports-[backdrop-filter]:bg-[rgb(12_16_24/0.45)] before:pointer-events-none before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent"
      >
        <span
          aria-hidden
          data-dock-indicator
          className={cn(
            glassPillClass,
            "dock-indicator pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/5)]",
            activeColumn === null && "opacity-0",
          )}
          style={{ transform: `translateX(${(activeColumn ?? 0) * 100}%)` }}
        />
        {mobileNavItems.map((item, index) => {
          const tab = (
            <ActiveNavLink
              key={item.href}
              href={item.href}
              match={isMobileNavCurrent}
              aria-label={item.label}
              data-nav={item.icon}
              className={(isCurrent) =>
                cn(
                  "tab-transition press-scale relative z-10 flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-caption font-medium outline-none",
                  focusRing,
                  isCurrent ? "text-paper" : "text-mist hover:text-paper",
                )
              }
            >
              {(isCurrent) => (
                <>
                  <NavIcon name={item.icon} day={item.icon === "today" ? day : null} />
                  <span
                    className={cn(
                      "max-w-full truncate text-center leading-tight",
                      !isCurrent && "opacity-60",
                    )}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </ActiveNavLink>
          );

          if (index !== mobileNavSearchSlot) {
            return tab;
          }

          return [
            <div key="search" className="relative z-10 flex justify-center">
              <ActiveNavLink
                href={mobileNavSearch.href}
                match={isMobileNavCurrent}
                aria-label={mobileNavSearch.label}
                data-nav={mobileNavSearch.icon}
                className={cn(glassIconClass, "dock-search size-12")}
              >
                <NavIcon name={mobileNavSearch.icon} />
              </ActiveNavLink>
            </div>,
            tab,
          ];
        })}
      </div>
    </BottomNavShell>
  );
};
