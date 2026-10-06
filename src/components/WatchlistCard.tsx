"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ListItemOrderControls } from "@/components/ListItemOrderControls";
import { PosterImage } from "@/components/PosterImage";
import type { FichaView } from "@/components/watchlist/types";
import { auraBloomImage, platformGlowRgb } from "@/lib/aura";
import { cn } from "@/lib/cn";
import { focusRing, glassRowClass } from "@/lib/ui";

type WatchlistReorderRowProps = {
  ficha: FichaView;
  position: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  pendingOrder?: boolean;
  onMove: (direction: "up" | "down") => void;
};

/** Edit-mode row: drag handle + arrows; the whole queue reorders in place. */
export const WatchlistReorderRow = ({
  ficha,
  position,
  canMoveUp,
  canMoveDown,
  pendingOrder = false,
  onMove,
}: WatchlistReorderRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ficha.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        backgroundImage: auraBloomImage(
          platformGlowRgb(ficha.platform?.platform ?? null),
          position === 1 ? 1.2 : 0.8,
        ),
      }}
      className={cn(
        glassRowClass,
        "flex items-center gap-3 px-2 py-2",
        isDragging && "z-30 border-accent/60 shadow-panel",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Arrastrar ${ficha.name}`}
        className={cn(
          "inline-flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-mist hover:text-paper active:cursor-grabbing",
          focusRing,
        )}
      >
        <DragHandleIcon />
      </button>
      <span
        className={cn(
          "w-6 shrink-0 text-center font-serif text-lg font-bold",
          position === 1 ? "text-accent" : "text-fog",
        )}
      >
        {position}
      </span>
      <div className="w-12 shrink-0">
        <PosterImage name={ficha.name} posterPath={ficha.posterPath} sizes="48px" className="rounded-md" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-paper">{ficha.name}</p>
        <p className="truncate text-xs text-mist">{ficha.meta}</p>
      </div>
      <ListItemOrderControls
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        pending={pendingOrder}
        onMove={onMove}
      />
    </li>
  );
};

const DragHandleIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5">
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </svg>
);
