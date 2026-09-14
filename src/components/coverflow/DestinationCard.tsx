"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type DestinationCardProps = {
  /** Virtual coverflow index: -1 (prev) or titles.length (next). */
  index: number;
  name: string;
  direction: "prev" | "next";
  onSelect: () => void;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  registerNode: (index: number, node: HTMLElement | null) => void;
};

/**
 * Frosted side-slot card hinting continuum into the neighboring genre.
 * Same footprint as a soft-coverflow side poster; painted by useCoverflowEngine.
 */
export const DestinationCard = memo(function DestinationCard({
  index,
  name,
  direction,
  onSelect,
  onPointerDown,
  registerNode,
}: DestinationCardProps) {
  const microcopy = direction === "next" ? "Desliza" : "Anterior";
  const arrow = direction === "next" ? "→" : "←";

  return (
    <article
      ref={(node) => registerNode(index, node)}
      id={`coverflow-destination-${direction}`}
      role="option"
      aria-label={`${direction === "next" ? "Siguiente" : "Anterior"} categoría: ${name}`}
      aria-selected="false"
      data-coverflow-destination={direction}
      className={cn(
        "coverflow-card coverflow-destination absolute origin-center is-cinematic",
      )}
      onPointerDown={onPointerDown}
    >
      <button
        type="button"
        data-coverflow-face
        tabIndex={-1}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect();
        }}
        className={cn(
          "coverflow-card-face coverflow-destination-face relative flex h-full w-full cursor-inherit flex-col items-center justify-center gap-2.5 overflow-hidden rounded-[20px] px-2.5 text-center sm:px-3",
          focusRing,
        )}
      >
        <span className="relative z-[1] max-w-[6.75rem] font-serif text-[1.2rem] leading-[1.15] tracking-tight text-paper sm:text-[1.35rem]">
          {name}
        </span>
        <span
          className="relative z-[1] text-[1.45rem] leading-none text-paper"
          aria-hidden
        >
          {arrow}
        </span>
        <span className="relative z-[1] text-[10px] font-semibold uppercase tracking-[0.18em] text-paper/90">
          {microcopy}
        </span>
      </button>
    </article>
  );
});
