"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

const navItems = [
  { href: "/", label: "Diario", icon: "home" },
  { href: "/watchlist", label: "Por ver", icon: "queue" },
  { href: "/buscar", label: "Registrar", icon: "log" },
  { href: "/listas", label: "Listas", icon: "lists" },
  { href: "/perfil", label: "Perfil", icon: "profile" },
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
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-end px-1">
        {navItems.map((item) => {
          const isCurrent = isCurrentPath(item.href, pathname);
          const isLog = item.icon === "log";

          return (
            <li key={item.href} className="flex justify-center">
              <Link
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "flex min-w-[56px] flex-col items-center gap-1 px-1 py-1 text-[10px] uppercase tracking-[0.12em]",
                  focusRing,
                  isLog
                    ? "text-ink"
                    : isCurrent
                      ? "text-accent"
                      : "text-mist hover:text-paper",
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center",
                    isLog
                      ? "mb-0.5 h-11 w-11 -translate-y-2 rounded-full bg-accent text-ink shadow-[0_8px_20px_rgba(124,156,255,0.32)]"
                      : "h-6 w-6",
                  )}
                >
                  <NavIcon name={item.icon} />
                </span>
                <span className={isLog ? "text-accent" : undefined}>{item.label}</span>
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

  if (name === "home") {
    return (
      <svg {...common}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 10.5 12 4l7.5 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5.5a1 1 0 0 1-1-1v-9.5Z"
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

  if (name === "log") {
    return (
      <svg {...common} className="h-6 w-6">
        <path strokeLinecap="round" d="M12 6.5v11M6.5 12h11" />
      </svg>
    );
  }

  if (name === "profile") {
    return (
      <svg {...common}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 12.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5.5 19.2c.7-2.4 3-3.7 6.5-3.7s5.8 1.3 6.5 3.7"
        />
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
