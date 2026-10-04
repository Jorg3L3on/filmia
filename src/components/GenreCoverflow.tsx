"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import type { DiaryCategory } from "@/lib/diary-picks";
import { focusRing } from "@/lib/ui";

type GenreCoverflowProps = {
  categories: readonly DiaryCategory[];
  activeSlug: string;
  onSelect: (slug: string) => void;
};

const SWIPE_THRESHOLD_PX = 42;

/**
 * Horizontal genre coverflow under Qué ver / Historial — replaces category chips.
 * Active center: large italic serif with poster-tinted halo. Neighbors: tracked caps.
 */
export const GenreCoverflow = ({
  categories,
  activeSlug,
  onSelect,
}: GenreCoverflowProps) => {
  const dragStartX = useRef<number | null>(null);
  const dragDeltaX = useRef(0);
  const suppressClick = useRef(false);

  const activeIndex = categories.findIndex(
    (category) => category.slug === activeSlug,
  );
  const safeIndex = activeIndex >= 0 ? activeIndex : 0;
  const prev = categories[safeIndex - 1] ?? null;
  const active = categories[safeIndex] ?? categories[0] ?? null;
  const next = categories[safeIndex + 1] ?? null;

  const goRelative = useCallback(
    (delta: -1 | 1) => {
      const target = categories[safeIndex + delta];
      if (!target) {
        return;
      }
      onSelect(target.slug);
    },
    [categories, onSelect, safeIndex],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    dragStartX.current = event.clientX;
    dragDeltaX.current = 0;
    suppressClick.current = false;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current == null) {
      return;
    }
    dragDeltaX.current = event.clientX - dragStartX.current;
    if (!suppressClick.current && Math.abs(dragDeltaX.current) > 8) {
      suppressClick.current = true;
      // Capture only once it's a swipe; capturing on pointerdown retargets taps away from the buttons.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current == null) {
      return;
    }
    const delta = dragDeltaX.current;
    dragStartX.current = null;
    dragDeltaX.current = 0;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (delta <= -SWIPE_THRESHOLD_PX) {
      goRelative(1);
      return;
    }
    if (delta >= SWIPE_THRESHOLD_PX) {
      goRelative(-1);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goRelative(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goRelative(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      const first = categories[0];
      if (first) {
        onSelect(first.slug);
      }
    } else if (event.key === "End") {
      event.preventDefault();
      const last = categories[categories.length - 1];
      if (last) {
        onSelect(last.slug);
      }
    }
  };

  if (!active || categories.length === 0) {
    return null;
  }

  return (
    <div
      role="listbox"
      aria-label="Categorías de Quiero ver"
      aria-activedescendant={`genre-coverflow-${active.slug}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="genre-coverflow relative mx-auto flex w-full max-w-lg touch-pan-y select-none flex-col items-center justify-center gap-0 rounded-2xl px-1 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <div className="genre-coverflow-glow" aria-hidden />

      <div className="relative z-[1] flex w-full items-center justify-center">
        {prev ? (
          <button
            type="button"
            role="option"
            aria-selected={false}
            tabIndex={-1}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              onSelect(prev.slug);
            }}
            className={cn(
              "genre-coverflow-neighbor genre-coverflow-neighbor-prev",
              focusRing,
            )}
          >
            <span aria-hidden className="genre-coverflow-chevron">
              ‹
            </span>
            <span className="truncate">{prev.name}</span>
          </button>
        ) : (
          <span className="genre-coverflow-neighbor-spacer" aria-hidden />
        )}

        <button
          type="button"
          role="option"
          id={`genre-coverflow-${active.slug}`}
          aria-selected="true"
          aria-current="true"
          tabIndex={-1}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
            }
          }}
          className={cn("genre-coverflow-active", focusRing)}
        >
          <span key={active.slug} className="font-serif">
            {active.name}
          </span>
        </button>

        {next ? (
          <button
            type="button"
            role="option"
            aria-selected={false}
            tabIndex={-1}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              onSelect(next.slug);
            }}
            className={cn(
              "genre-coverflow-neighbor genre-coverflow-neighbor-next",
              focusRing,
            )}
          >
            <span className="truncate">{next.name}</span>
            <span aria-hidden className="genre-coverflow-chevron">
              ›
            </span>
          </button>
        ) : (
          <span className="genre-coverflow-neighbor-spacer" aria-hidden />
        )}
      </div>

      {categories.length > 1 ? (
        <div className="genre-coverflow-dots" aria-hidden>
          {categories.map((category, index) => (
            <span
              key={category.slug}
              className={cn(
                "genre-coverflow-dot",
                index === safeIndex && "is-active",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
