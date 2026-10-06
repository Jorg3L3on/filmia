"use client";

import type { ReactNode } from "react";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { staggerStyle } from "@/lib/motion-style";
import { focusRing } from "@/lib/ui";

export type PosterTileState = "none" | "seen" | "favorite" | "selected" | "pending";

type PosterPickTileProps = {
  name: string;
  posterPath: string | null;
  year?: number | null;
  state: PosterTileState;
  onClick: () => void;
  ariaLabel: string;
  index?: number;
  /** Corner badge: IMDb score, platform logo… */
  badge?: ReactNode;
  caption?: string | null;
  disabled?: boolean;
  priority?: boolean;
  className?: string;
};

/** Poster button for the Bienvenida grids: VISTO stamp when seen, crown when favorite, check when queued. */
export const PosterPickTile = ({
  name,
  posterPath,
  year,
  state,
  onClick,
  ariaLabel,
  index = 0,
  badge,
  caption,
  disabled = false,
  priority = false,
  className,
}: PosterPickTileProps) => (
  <li className={cn("stagger-in min-w-0", className)} style={staggerStyle(index, 40)}>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={state === "selected" || state === "favorite" || state === "seen"}
      data-state={state}
      className={cn(
        "year-tile press-scale group relative block w-full overflow-hidden rounded-poster bg-well text-left shadow-[0_10px_24px_rgba(0,0,0,0.45)]",
        "transition-[box-shadow,transform] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
        state === "favorite" && "is-favorite",
        state === "seen" && "is-seen",
        state === "selected" && "is-selected",
        state === "pending" && "is-pending",
        focusRing,
      )}
    >
      <PosterImage name={name} posterPath={posterPath} priority={priority} sizes="(max-width: 640px) 33vw, 160px" />
      <span className="year-tile-scrim" aria-hidden="true" />
      {state === "seen" || state === "favorite" ? (
        <span className="visto-stamp is-tile" aria-hidden="true">
          Visto
        </span>
      ) : null}
      {state === "favorite" ? (
        <span className="year-crown" aria-hidden="true">
          <CrownIcon />
        </span>
      ) : null}
      {state === "selected" ? (
        <span className="year-check" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
      ) : null}
      {badge ? <span className="year-tile-badge">{badge}</span> : null}
      <span className="year-tile-caption">
        <span className="block truncate text-[12px] font-semibold leading-tight text-paper">{name}</span>
        {caption ?? year ? (
          <span className="block truncate text-[11px] text-paper/70">{caption ?? year}</span>
        ) : null}
      </span>
    </button>
  </li>
);

const CrownIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
    <path d="M3 8.5 7.5 12 12 5l4.5 7L21 8.5 19.5 18h-15L3 8.5Zm1.5 11h15v1.5h-15Z" />
  </svg>
);
