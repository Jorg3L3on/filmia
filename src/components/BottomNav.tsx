"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition, useEffect, useState, useSyncExternalStore } from "react";
import { ActiveNavLink } from "@/components/ActiveNavLink";
import { BottomNavShell } from "@/components/BottomNavShell";
import { DockSearchField } from "@/components/DockSearchField";
import { NavIcon } from "@/components/NavIcon";
import { cn } from "@/lib/cn";
import { dockSearch, readLastDockTab, writeLastDockTab } from "@/lib/dock-search";
import {
  DOCK_SEARCH_TRANSITION,
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
const noTab = () => null;

/** Day number for the Hoy glyph; null during SSR/hydration so markup matches. */
const useTodayDay = () => useSyncExternalStore(subscribeNoop, todayDay, noDay);

/**
 * Only the dock's own taps (disc → Buscar, left disc → back) morph; tab to tab,
 * browser back and every other navigation leave the dock alone.
 */
const DOCK_MORPH = { [DOCK_SEARCH_TRANSITION]: "morph", default: "none" } as const;

/** Glass of the dock pill, shared by the Buscar field. */
export const dockGlassClass =
  "border border-white/12 bg-[rgb(12_16_24/0.72)] shadow-panel backdrop-blur-2xl backdrop-saturate-180 supports-[backdrop-filter]:bg-[rgb(12_16_24/0.45)] before:pointer-events-none before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent";

/**
 * The tab Buscar was opened from (Hoy until we know). Tracked during render so
 * the morph's first frame already shows the right icon; sessionStorage only
 * covers a reload straight into /buscar.
 */
const useOriginTab = (pathname: string, searchMode: boolean) => {
  const current = mobileNavItems.find((item) => isMobileNavCurrent(item.href, pathname));
  const [lastTab, setLastTab] = useState<string | null>(null);
  if (current && current.href !== lastTab) {
    setLastTab(current.href);
  }

  useEffect(() => {
    if (current) {
      writeLastDockTab(current.href);
    }
  }, [current]);

  // Server snapshot null, so hydration matches; the stored tab shows right after.
  const storedTab = useSyncExternalStore(subscribeNoop, readLastDockTab, noTab);
  const href = current?.href ?? lastTab ?? (searchMode ? storedTab : null);
  return mobileNavItems.find((item) => item.href === href) ?? mobileNavItems[0];
};

/**
 * Floating glass dock: four tabs + center Buscar disc, sliding glass pill on
 * the active tab. On /buscar it changes shape: the tabs fold into one disc on
 * the left (the tab you came from) and the center disc stretches into the search
 * field, which moves to the top of the screen under the header, where people
 * expect a search box (it used to ride at the bottom, above the keyboard).
 */
export const BottomNav = () => {
  const pathname = usePathname();
  const day = useTodayDay();
  const searchMode = isMobileNavCurrent(mobileNavSearch.href, pathname);
  const origin = useOriginTab(pathname, searchMode);
  const activeIndex = mobileNavItems.findIndex((item) =>
    isMobileNavCurrent(item.href, pathname),
  );
  const activeColumn = activeIndex === -1 ? null : columnFor(activeIndex);

  // Leaving Buscar: the next visit starts from its own URL, not the last words.
  useEffect(() => {
    if (!searchMode) {
      dockSearch.reset();
    }
  }, [searchMode]);

  if (searchMode) {
    return (
      <BottomNavShell placement="top">
        {/* Results fade out under the field instead of colliding with it. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-[calc(3rem+env(safe-area-inset-top))] -z-10 h-[4.25rem] bg-gradient-to-b from-canvas via-canvas/95 to-canvas/0"
        />
        <div className="flex items-center gap-2.5">
          <ViewTransition name="dock-shell" share={DOCK_MORPH} default="none">
            <Link
              href={origin.href}
              transitionTypes={[DOCK_SEARCH_TRANSITION]}
              aria-label={`Volver a ${origin.label}`}
              data-nav={origin.icon}
              className={cn(
                dockGlassClass,
                // The glass highlight is a hairline across the top: on a round disc it reads as a stray white line.
                "before:hidden press-scale relative flex size-[3.375rem] shrink-0 items-center justify-center rounded-full text-paper",
                focusRing,
              )}
            >
              <NavIcon name={origin.icon} day={origin.icon === "today" ? day : null} />
            </Link>
          </ViewTransition>
          <ViewTransition name="dock-search" share={DOCK_MORPH} default="none">
            <DockSearchField />
          </ViewTransition>
        </div>
      </BottomNavShell>
    );
  }

  return (
    <BottomNavShell>
      <ViewTransition name="dock-shell" share={DOCK_MORPH} default="none">
        <div
          data-dock-shell
          className={cn(dockGlassClass, "relative grid h-16 grid-cols-5 items-center rounded-full px-1")}
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
              <div
                key="search"
                className="relative z-10 flex justify-center"
                onClickCapture={dockSearch.requestFocus}
              >
                <ViewTransition name="dock-search" share={DOCK_MORPH} default="none">
                  <ActiveNavLink
                    href={mobileNavSearch.href}
                    match={isMobileNavCurrent}
                    aria-label={mobileNavSearch.label}
                    data-nav={mobileNavSearch.icon}
                    transitionTypes={[DOCK_SEARCH_TRANSITION]}
                    className={cn(glassIconClass, "dock-search size-12")}
                  >
                    <NavIcon name={mobileNavSearch.icon} />
                  </ActiveNavLink>
                </ViewTransition>
              </div>,
              tab,
            ];
          })}
        </div>
      </ViewTransition>
    </BottomNavShell>
  );
};
