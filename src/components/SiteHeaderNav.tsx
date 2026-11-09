"use client";

import { ActiveNavLink } from "@/components/ActiveNavLink";
import { useNavTabMatch } from "@/components/useNavTabMatch";
import { cn } from "@/lib/cn";
import { desktopNavItems } from "@/lib/nav";
import { focusRing } from "@/lib/ui";

/** Desktop header nav. No avatar and no Salir: Perfil is a tab and Salir lives at the end of Perfil. */
export const SiteHeaderNav = () => {
  // A ficha lights the tab it was opened from (FIL-I44-8).
  const matchTab = useNavTabMatch();
  return (
    <nav aria-label="Principal" className="hidden items-center gap-1 text-sm sm:flex">
      {desktopNavItems.map((item) => (
        <ActiveNavLink
          key={item.href}
          href={item.href}
          match={matchTab}
          className={(isCurrent) =>
            cn(
              "rounded-full px-3 py-1.5 tab-transition",
              focusRing,
              isCurrent
                ? cn("font-medium text-ink", item.href === "/cine" ? "bg-cine" : "bg-accent")
                : "text-fog hover:bg-chrome hover:text-paper",
            )
          }
        >
          {item.label}
        </ActiveNavLink>
      ))}
    </nav>
  );
};
