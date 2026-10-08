"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { safeAreaInsetXPadClass } from "@/lib/ui";

type BottomNavShellProps = {
  children: ReactNode;
  /** iOS keyboard height while the Buscar field has focus: the dock rides above it. */
  keyboardInset?: number;
};

/**
 * Tiny client leaf: floating glass dock frame + blur stale focus on route change.
 * The dock floats above the home indicator: max(safe-area-inset-bottom, 0.75rem).
 */
export const BottomNavShell = ({ children, keyboardInset = 0 }: BottomNavShellProps) => {
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
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 sm:hidden",
        keyboardInset > 0 ? "pb-2" : "pb-[max(env(safe-area-inset-bottom),0.75rem)]",
        safeAreaInsetXPadClass,
      )}
      style={keyboardInset > 0 ? { bottom: keyboardInset } : undefined}
    >
      <div className="pointer-events-auto relative mx-auto max-w-lg">{children}</div>
    </nav>
  );
};
