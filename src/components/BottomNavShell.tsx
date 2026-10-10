"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { safeAreaInsetXPadClass } from "@/lib/ui";

type BottomNavShellProps = {
  children: ReactNode;
  /**
   * `bottom` (tabs) floats above the home indicator; `top` (the Buscar field) sits right under
   * the header, where people look for a search box, and needs no keyboard handling.
   */
  placement?: "bottom" | "top";
};

/**
 * Tiny client leaf: floating glass dock frame + blur stale focus on route change.
 * The tab dock floats above the home indicator: max(safe-area-inset-bottom, 0.75rem). The
 * Buscar field sits under the 3 rem header instead (see SiteHeader).
 */
export const BottomNavShell = ({ children, placement = "bottom" }: BottomNavShellProps) => {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = navRef.current;
    if (!root) {
      return;
    }

    const focused = root.querySelector<HTMLElement>(":focus");
    // The Buscar field keeps its focus: arriving from the dock disc focuses it on purpose.
    if (focused && focused.getAttribute("aria-current") !== "page" && !focused.matches("input")) {
      focused.blur();
    }
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      aria-label="Principal móvil"
      className={cn(
        "pointer-events-none fixed inset-x-0 z-50 sm:hidden",
        placement === "top"
          ? "top-[calc(3rem+env(safe-area-inset-top))] pt-2"
          : "bottom-0 pb-[max(env(safe-area-inset-bottom),0.75rem)]",
        safeAreaInsetXPadClass,
      )}
    >
      <div className="pointer-events-auto relative mx-auto max-w-lg">{children}</div>
    </nav>
  );
};
