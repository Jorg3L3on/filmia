"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { NavIcon } from "@/components/NavIcon";
import { cn } from "@/lib/cn";
import { mobileCreateActions } from "@/lib/nav";
import {
  glassIconClass,
  glassMenuIconPillClass,
  glassMenuItemClass,
  glassMenuPanelClass,
} from "@/lib/ui";

/** Center «+» of the dock: glass disc that opens the quick-create menu above it. */
export const BottomNavCreate = () => {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const isOpen = openOn === pathname;
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const close = () => setOpenOn(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenOn(null);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenOn(null);
      }
    };

    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    rootRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus();

    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="flex justify-center">
      {isOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Crear"
          className={cn(
            glassMenuPanelClass,
            "dock-menu-pop absolute bottom-[calc(100%+0.75rem)] left-1/2 w-[min(17.5rem,calc(100vw-1.5rem))] -translate-x-1/2",
          )}
        >
          {mobileCreateActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              role="menuitem"
              onClick={close}
              className={glassMenuItemClass}
            >
              <span className={glassMenuIconPillClass}>
                <NavIcon name={action.icon} />
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{action.label}</span>
                <span className="block truncate text-caption text-fog">{action.hint}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        data-nav="create"
        aria-label={isOpen ? "Cerrar menú crear" : "Crear"}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setOpenOn(isOpen ? null : pathname)}
        className={cn(glassIconClass, "size-12")}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          aria-hidden
          className={cn(
            "size-6 transition-transform duration-[var(--duration-tab)] ease-[var(--ease-out)]",
            isOpen && "rotate-45",
          )}
        >
          <path d="M12 5.5v13M5.5 12h13" />
        </svg>
      </button>
    </div>
  );
};
