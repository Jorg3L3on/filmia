"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SearchResultRowBody, type SearchRowStatus } from "@/components/tmdb-search/SearchResultRow";
import { cn } from "@/lib/cn";
import type { SearchResultFacts } from "@/lib/search-result-facts";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { diaryDayLabel } from "@/lib/title-preview";
import { focusRing, glassRowClass } from "@/lib/ui";

/** How the menu opened: a touch hold skips the focus ring (FIL-I22-1); mouse, pen and keyboard get it. */
export type SearchMenuVia = "touch" | "pointer";

export type SearchMenuTarget = { result: TmdbCatalogResult; anchor: DOMRect; via?: SearchMenuVia };

/** `via` for a pointer type (`PointerEvent.pointerType`); a contextmenu or key is «pointer». */
export const menuVia = (pointerType: string | null | undefined): SearchMenuVia =>
  pointerType === "touch" ? "touch" : "pointer";

type SearchRowMenuProps = {
  target: SearchMenuTarget | null;
  titleId: string | null;
  status: SearchRowStatus;
  facts: SearchResultFacts | null;
  /** Diario mode: «Vi esto» logs on this day (null = today). */
  logMode: boolean;
  logDate: string | null;
  /** «Ver esta noche» is offered (not watched, not logging). */
  canPin: boolean;
  /** This result is tonight's pin already. */
  pinned: boolean;
  onClose: () => void;
  onWatchlist: () => void;
  onWatched: () => void;
  onPin: () => void;
  onLists: () => void;
  onOpenFicha: () => void;
  /** What lifts over the blur instead of the Buscar row (Cine lifts the held poster). */
  lift?: ReactNode;
};

const MENU_WIDTH = 262;
const ITEM_HEIGHT = 46;
const GAP = 10;
/** The dock and the safe area at the bottom of a phone. */
const BOTTOM_CLEARANCE = 96;

/** Below the row when it fits, above it otherwise; always inside the viewport. */
const menuPosition = (anchor: DOMRect, items: number): CSSProperties => {
  const height = items * ITEM_HEIGHT + 24;
  const viewportHeight = window.innerHeight;
  const below = anchor.bottom + GAP;
  const top =
    below + height <= viewportHeight - BOTTOM_CLEARANCE
      ? below
      : Math.max(12, anchor.top - GAP - height);
  const left = Math.min(Math.max(12, anchor.left), window.innerWidth - MENU_WIDTH - 12);
  return { top, left, width: MENU_WIDTH };
};

/**
 * Mantener A «Menú anclado» (FIL-I8): the held row lifts over the blurred list
 * and a glass menu opens under it with the shortcuts the old preview sheet
 * had. Tapping outside, Escape or scrolling closes it.
 */
export const SearchRowMenu = ({
  target,
  titleId,
  status,
  facts,
  logMode,
  logDate,
  canPin,
  pinned,
  onClose,
  onWatchlist,
  onWatched,
  onPin,
  onLists,
  onOpenFicha,
  lift,
}: SearchRowMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  /**
   * The pointer that went down on the scrim, if any. The hold that opened the
   * menu ends with a pointerup + click that land on the scrim (it is already
   * over the row): without a pointerdown of their own they are ignored, so the
   * menu stays open until a real tap or click outside (FIL-I22-1).
   */
  const scrimPointerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!target) {
      return;
    }
    scrimPointerRef.current = null;
    const panel = menuRef.current;
    if (target.via === "touch") {
      // A thumb opened it: no item gets the focus ring; the panel takes focus so Escape still works.
      panel?.focus({ preventScroll: true });
    } else {
      panel?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus({ preventScroll: true });
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, { passive: true });
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [target, onClose]);

  if (!target || typeof document === "undefined") {
    return null;
  }

  const { result, anchor } = target;
  const watched = status === "watched";
  const inWatchlist = status === "watchlist";
  const items: ReactNode[] = [
    <MenuItem
      key="watchlist"
      label={inWatchlist ? "En Quiero ver" : "Quiero ver"}
      icon={<BookmarkIcon filled={inWatchlist} />}
      disabled={inWatchlist || watched}
      onSelect={onWatchlist}
    />,
    <MenuItem
      key="watched"
      label={logMode ? `Registrar vista · ${diaryDayLabel(logDate)}` : watched ? "La viste" : "Vi esto"}
      icon={logMode || watched ? <CheckIcon /> : <EyeIcon />}
      tone={logMode ? "success" : undefined}
      disabled={watched && !logMode}
      onSelect={onWatched}
    />,
  ];
  if (canPin) {
    items.push(
      <MenuItem
        key="tonight"
        label={pinned ? "Fijada para esta noche" : "Ver esta noche"}
        icon={<MoonIcon filled={pinned} />}
        tone="accent"
        disabled={pinned}
        onSelect={onPin}
      />,
    );
  }
  items.push(
    <MenuItem key="lists" label="Agregar a lista" icon={<ListIcon />} onSelect={onLists} />,
    <span key="sep" aria-hidden="true" className="mx-3 my-1 block h-px bg-white/8" />,
    <MenuItem key="ficha" label="Ver ficha" icon={<ArrowIcon />} tone="muted" onSelect={onOpenFicha} />,
  );

  return createPortal(
    <div className="search-menu fixed inset-0 z-[80]">
      <div
        className="search-menu-scrim absolute inset-0"
        aria-hidden="true"
        onPointerDown={(event: PointerEvent) => {
          scrimPointerRef.current = event.pointerId;
        }}
        onPointerCancel={() => {
          scrimPointerRef.current = null;
        }}
        onClick={() => {
          // Only a click whose pointer began on the scrim closes (not the release of the opening hold).
          if (scrimPointerRef.current !== null) {
            scrimPointerRef.current = null;
            onClose();
          }
        }}
      />
      {lift ? (
        <div
          aria-hidden="true"
          className="search-menu-lift pointer-events-none fixed"
          style={{ top: anchor.top, left: anchor.left, width: anchor.width, height: anchor.height }}
        >
          {lift}
        </div>
      ) : (
        <div
          aria-hidden="true"
          className={cn(glassRowClass, "search-menu-lift pointer-events-none fixed flex items-center gap-3 bg-[rgb(36_43_51/0.96)] p-2.5")}
          style={{ top: anchor.top, left: anchor.left, width: anchor.width, minHeight: anchor.height }}
        >
          <SearchResultRowBody result={result} titleId={titleId} status={status} facts={facts} />
        </div>
      )}
      <div
        ref={menuRef}
        role="menu"
        tabIndex={-1}
        aria-label={`Acciones de ${result.name}`}
        className="search-menu-panel fixed rounded-[1.375rem] border border-white/14 bg-[rgb(22_26_31/0.94)] p-1.5 shadow-[0_24px_60px_rgb(0_0_0/0.7)] outline-none backdrop-blur-xl"
        style={menuPosition(anchor, items.length - 1)}
        onClick={(event) => event.stopPropagation()}
      >
        {items}
      </div>
    </div>,
    document.body,
  );
};

const MenuItem = ({
  label,
  icon,
  tone,
  disabled = false,
  onSelect,
}: {
  label: string;
  icon: ReactNode;
  tone?: "accent" | "success" | "muted";
  disabled?: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    role="menuitem"
    disabled={disabled}
    onClick={onSelect}
    className={cn(
      "flex h-[46px] w-full items-center justify-between gap-3 rounded-2xl px-3.5 text-left text-[15px] text-paper transition-colors duration-[var(--duration-hover)] hover:bg-white/[0.06] disabled:opacity-55 disabled:hover:bg-transparent",
      tone === "accent" && "text-accent-hover",
      tone === "success" && "text-success",
      tone === "muted" && "text-paper/75",
      focusRing,
    )}
  >
    <span className="truncate">{label}</span>
    {icon}
  </button>
);

const iconProps = {
  viewBox: "0 0 24 24",
  className: "size-[18px] shrink-0",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const BookmarkIcon = ({ filled }: { filled: boolean }) => (
  <svg {...iconProps} fill={filled ? "currentColor" : "none"}>
    <path d="M7 4.5h10.5a1 1 0 0 1 1 1V20L12.25 16.5 6 20V5.5a1 1 0 0 1 1-1Z" />
  </svg>
);

const EyeIcon = () => (
  <svg {...iconProps}>
    <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
);

const CheckIcon = () => (
  <svg {...iconProps} strokeWidth={2}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.3 2.4 2.4 4.6-5" />
  </svg>
);

const MoonIcon = ({ filled }: { filled: boolean }) => (
  <svg {...iconProps} fill={filled ? "currentColor" : "none"}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
  </svg>
);

const ListIcon = () => (
  <svg {...iconProps}>
    <path d="M6 8h12M6 12h12M6 16h7M16.5 15.5v5M14 18h5" />
  </svg>
);

const ArrowIcon = () => (
  <svg {...iconProps}>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);
