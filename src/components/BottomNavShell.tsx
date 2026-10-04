"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { safeAreaInsetXPadClass } from "@/lib/ui";

type BottomNavShellProps = {
  children: ReactNode;
};

/**
 * Tiny client leaf: floating glass dock frame + blur stale focus on route change.
 * The dock floats above the home indicator: max(safe-area-inset-bottom, 0.75rem).
 */
export const BottomNavShell = ({ children }: BottomNavShellProps) => {
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
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:hidden",
        safeAreaInsetXPadClass,
      )}
    >
      <div className="pointer-events-auto relative mx-auto max-w-lg">{children}</div>
    </nav>
  );
};
