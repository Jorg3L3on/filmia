"use client";

import { ActiveNavLink } from "@/components/ActiveNavLink";
import { LogoutButton } from "@/components/LogoutButton";
import { cn } from "@/lib/cn";
import { desktopNavItems } from "@/lib/nav";
import { focusRing } from "@/lib/ui";

type SiteHeaderNavProps = {
  user: {
    name?: string | null;
    email?: string | null;
  } | null;
};

/** Server header nav — active state + logout stay in small client leaves. */
export const SiteHeaderNav = ({ user }: SiteHeaderNavProps) => {
  const displayName = user?.name?.trim() || user?.email || "Perfil";
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <>
      <nav aria-label="Principal" className="hidden items-center gap-1 text-sm sm:flex">
        {desktopNavItems.map((item) => (
          <ActiveNavLink
            key={item.href}
            href={item.href}
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
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        {/* Mobile: avatar only on Perfil. Desktop: always show. */}
        <ActiveNavLink
          href="/perfil"
          title="Perfil"
          aria-label={`Perfil de ${displayName}`}
          className={(isProfile) =>
            cn(
              "items-center gap-2 rounded-full p-0.5 text-xs transition sm:max-w-[14rem] sm:py-1 sm:pr-3 sm:pl-1",
              focusRing,
              isProfile ? "inline-flex" : "hidden sm:inline-flex",
              isProfile
                ? "bg-accent font-medium text-ink"
                : "text-mist hover:bg-chrome hover:text-paper",
            )
          }
        >
          {(isProfile) => (
            <>
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold sm:h-7 sm:w-7",
                  isProfile ? "bg-ink/15 text-ink" : "bg-chrome text-paper",
                )}
                aria-hidden
              >
                {initial}
              </span>
              <span className="hidden min-w-0 truncate sm:inline">{displayName}</span>
            </>
          )}
        </ActiveNavLink>
        <span className="hidden sm:inline-flex">
          <LogoutButton />
        </span>
      </div>
    </>
  );
};
