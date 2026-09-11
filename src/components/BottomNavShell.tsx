"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

type BottomNavShellProps = {
  children: ReactNode;
};

/** Tiny client leaf: mobile nav frame + blur stale focus on route change. */
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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-canvas/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur sm:hidden"
    >
      {children}
    </nav>
  );
};
