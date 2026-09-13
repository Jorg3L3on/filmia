"use client";

import { ActiveNavLink } from "@/components/ActiveNavLink";
import { BottomNavShell } from "@/components/BottomNavShell";
import { NavIcon } from "@/components/NavIcon";
import { cn } from "@/lib/cn";
import { isMobileNavCurrent, mobileNavItems } from "@/lib/nav";
import { focusRing } from "@/lib/ui";

/** Server mobile nav — shell focus + active links are tiny client leaves. */
export const BottomNav = () => (
  <BottomNavShell>
    <ul className="mx-auto grid max-w-lg grid-cols-5 items-end px-1">
      {mobileNavItems.map((item) => {
        const isSearch = item.icon === "search";

        return (
          <li key={item.href} className="flex justify-center">
            <ActiveNavLink
              href={item.href}
              match={isMobileNavCurrent}
              aria-label={item.label}
              data-nav={item.icon}
              className={(isCurrent) =>
                cn(
                  "tab-transition flex min-w-0 flex-col items-center gap-1 px-0.5 py-1 text-[10px] uppercase tracking-[0.08em] outline-none",
                  focusRing,
                  isCurrent ? "text-accent" : "text-mist hover:text-paper",
                )
              }
            >
              {(isCurrent) => (
                <>
                  <span
                    className={cn(
                      "flex items-center justify-center",
                      isSearch
                        ? cn(
                            "mb-0.5 h-12 w-12 -translate-y-2 rounded-full",
                            isCurrent
                              ? "bg-accent text-ink shadow-[0_8px_20px_rgba(124,156,255,0.32)]"
                              : "bg-chrome text-paper shadow-[0_8px_20px_rgba(0,0,0,0.35)]",
                          )
                        : "h-6 w-6 rounded-none bg-transparent shadow-none",
                    )}
                  >
                    <NavIcon name={item.icon} />
                  </span>
                  <span className="text-center leading-tight">{item.label}</span>
                </>
              )}
            </ActiveNavLink>
          </li>
        );
      })}
    </ul>
  </BottomNavShell>
);
