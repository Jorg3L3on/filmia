"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

const navItems = [
  { href: "/", label: "Diario", icon: "diary" },
  { href: "/watchlist", label: "Quiero ver", icon: "queue" },
  { href: "/buscar", label: "Buscar", icon: "search" },
  { href: "/listas", label: "Listas", icon: "lists" },
] as const;

const isCurrentPath = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

export const BottomNav = () => {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Principal móvil"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-canvas/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur sm:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 items-end px-1">
        {navItems.map((item) => {
          const isCurrent = isCurrentPath(item.href, pathname);
          const isSearch = item.icon === "search";

          return (
            <li key={item.href} className="flex justify-center">
              <Link
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "flex min-w-[56px] flex-col items-center gap-1 px-1 py-1 text-[10px] uppercase tracking-[0.12em]",
                  focusRing,
                  isSearch
                    ? "text-ink"
                    : isCurrent
                      ? "text-accent"
                      : "text-mist hover:text-paper",
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center",
                    isSearch
                      ? "mb-0.5 h-12 w-12 -translate-y-2 rounded-full bg-accent text-ink shadow-[0_8px_20px_rgba(124,156,255,0.32)]"
                      : "h-6 w-6",
                  )}
                >
                  <NavIcon name={item.icon} />
                </span>
                <span className={isSearch ? "text-accent" : undefined}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

const NavIcon = ({ name }: { name: (typeof navItems)[number]["icon"] }) => {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    className: "h-5 w-5",
    "aria-hidden": true,
  } as const;

  if (name === "diary") {
    return (
      <svg {...common}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.5 5.5h11A1.5 1.5 0 0 1 19 7v12.5l-7-3-7 3V7A1.5 1.5 0 0 1 6.5 5.5Z"
        />
      </svg>
    );
  }

  if (name === "queue") {
    return (
      <svg {...common}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 4.5h10.5a1 1 0 0 1 1 1V20L12.25 16.5 6 20V5.5a1 1 0 0 1 1-1Z"
        />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg {...common} className="h-6 w-6">
        <circle cx="11" cy="11" r="5.5" />
        <path strokeLinecap="round" d="m15.5 15.5 4 4" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 7h12M6 12h12M6 17h8"
      />
    </svg>
  );
};
