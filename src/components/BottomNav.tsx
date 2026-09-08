"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { isCurrentPath, mobileNavItems, type MobileNavIcon } from "@/lib/nav";
import { focusRing } from "@/lib/ui";

export const BottomNav = () => {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = navRef.current;
    if (!root) {
      return;
    }

    const focused = root.querySelector<HTMLElement>(":focus");
    if (focused && focused.getAttribute("aria-current") !== "page") {
      focused.blur();
    }
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      aria-label="Principal móvil"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-canvas/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur sm:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-end px-1">
        {mobileNavItems.map((item) => {
          const isCurrent = isCurrentPath(item.href, pathname);
          const isSearch = item.icon === "search";

          return (
            <li key={item.href} className="flex justify-center">
              <Link
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                aria-label={item.label}
                data-nav={item.icon}
                data-active={isCurrent ? "true" : "false"}
                className={cn(
                  "tab-transition flex min-w-0 flex-col items-center gap-1 px-0.5 py-1 text-[10px] uppercase tracking-[0.08em] outline-none",
                  focusRing,
                  isCurrent ? "text-accent" : "text-mist hover:text-paper",
                )}
              >
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
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

const NavIcon = ({ name }: { name: MobileNavIcon }) => {
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
          d="M6 5.25h5.25A1.75 1.75 0 0 1 13 7v12.25H7.75A1.75 1.75 0 0 1 6 17.5V5.25Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 7h4.25A1.75 1.75 0 0 1 19 8.75V19.25H13"
        />
        <path strokeLinecap="round" d="M8.25 8.75h2.5M8.25 11.5h2.5" />
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

  if (name === "profile") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8.25" r="3.15" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5.6 18.75c.85-3.05 2.95-4.75 6.4-4.75s5.55 1.7 6.4 4.75"
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
