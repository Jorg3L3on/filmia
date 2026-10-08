"use client";

import { ActiveNavLink } from "@/components/ActiveNavLink";
import { cn } from "@/lib/cn";
import { desktopNavItems, isDesktopNavCurrent } from "@/lib/nav";
import { focusRing } from "@/lib/ui";

/** Desktop header nav. No avatar and no Salir: Perfil is a tab and Salir lives at the end of Perfil. */
export const SiteHeaderNav = () => (
  <nav aria-label="Principal" className="hidden items-center gap-1 text-sm sm:flex">
    {desktopNavItems.map((item) => (
      <ActiveNavLink
        key={item.href}
        href={item.href}
        match={isDesktopNavCurrent}
        className={(isCurrent) =>
          cn(
            "rounded-full px-3 py-1.5 tab-transition",
            focusRing,
            isCurrent
              ? "bg-accent font-medium text-ink"
              : "text-fog hover:bg-chrome hover:text-paper",
          )
        }
      >
        {item.label}
      </ActiveNavLink>
    ))}
  </nav>
);
