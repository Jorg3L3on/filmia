"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { cn } from "@/lib/cn";
import { desktopNavItems, isCurrentPath } from "@/lib/nav";
import { focusRing } from "@/lib/ui";

type SiteHeaderNavProps = {
  user: {
    name?: string | null;
    email?: string | null;
  } | null;
};

export const SiteHeaderNav = ({ user }: SiteHeaderNavProps) => {
  const pathname = usePathname();
  const displayName = user?.name?.trim() || user?.email || "Perfil";
  const initial = displayName.slice(0, 1).toUpperCase();
  const isProfile = isCurrentPath("/perfil", pathname);
  const isTags = isCurrentPath("/tags", pathname);

  return (
    <>
      <nav aria-label="Principal" className="hidden items-center gap-1 text-sm sm:flex">
        {desktopNavItems.map((item) => {
          const isCurrent = isCurrentPath(item.href, pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 tab-transition",
                focusRing,
                isCurrent
                  ? "bg-accent font-medium text-ink"
                  : "text-fog hover:bg-chrome hover:text-paper",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <Link
          href="/tags"
          aria-current={isTags ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] tab-transition sm:hidden",
            focusRing,
            isTags
              ? "bg-accent text-ink"
              : "text-fog hover:bg-chrome hover:text-paper",
          )}
        >
          Etiquetas
        </Link>
        <Link
          href="/perfil"
          title="Perfil"
          aria-label={`Perfil de ${displayName}`}
          aria-current={isProfile ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-2 rounded-full p-0.5 text-xs transition sm:max-w-[14rem] sm:py-1 sm:pr-3 sm:pl-1",
            focusRing,
            isProfile
              ? "bg-accent font-medium text-ink"
              : "text-mist hover:bg-chrome hover:text-paper",
          )}
        >
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
        </Link>
        <span className="hidden sm:inline-flex">
          <LogoutButton />
        </span>
      </div>
    </>
  );
};
