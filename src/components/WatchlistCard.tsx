"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ListItemOrderControls } from "@/components/ListItemOrderControls";
import { PosterImage } from "@/components/PosterImage";
import { PosterPlatformBadge } from "@/components/PosterPlatformBadge";
import { SharedPoster } from "@/components/SharedPoster";
import { WatchlistMarkSeenButton } from "@/components/WatchlistMarkSeenButton";
import type { WatchlistItem } from "@/components/watchlist-types";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import { focusRing } from "@/lib/ui";

type WatchlistReorderRowProps = {
  item: WatchlistItem;
  position: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  pendingOrder?: boolean;
  onMove: (direction: "up" | "down") => void;
};

/** Edit-mode row: drag handle + arrows; the whole queue reorders in place. */
export const WatchlistReorderRow = ({
  item,
  position,
  canMoveUp,
  canMoveDown,
  pendingOrder = false,
  onMove,
}: WatchlistReorderRowProps) => {
  const { title } = item;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.titleId });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative flex items-center gap-3 rounded-2xl border bg-surface px-2 py-2",
        isDragging
          ? "z-30 border-accent/60 shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
          : "border-line",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Arrastrar ${title.name}`}
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
        <PosterImage
          name={title.name}
          posterPath={title.posterPath}
          sizes="48px"
          className="rounded-md"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-paper">{title.name}</p>
        <p className="truncate text-xs text-mist">
          {title.year ? `${title.year} · ` : ""}
          {TITLE_KIND_LABEL[title.kind]}
        </p>
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

type WatchlistPosterProps = {
  title: WatchlistItem["title"];
  size: "hero" | "queue";
  className: string;
  posterClassName: string;
  sizes: string;
  preferredPlatforms?: readonly Platform[];
  priority?: boolean;
  onMarkedSeen?: () => void;
  onMarkSeenError?: () => void;
};

export const WatchlistPoster = ({
  title,
  size,
  className,
  posterClassName,
  sizes,
  preferredPlatforms = [],
  priority = false,
  onMarkedSeen,
  onMarkSeenError,
}: WatchlistPosterProps) => (
  <div className={cn("group relative", className)}>
    <Link
      href={`/titulos/${title.id}`}
      aria-label={title.name}
      className={cn("press-scale block", focusRing)}
    >
      <SharedPoster titleId={title.id}>
        <PosterImage
          name={title.name}
          posterPath={title.posterPath}
          className={posterClassName}
          sizes={sizes}
          priority={priority}
        />
      </SharedPoster>
    </Link>
    <WatchlistMarkSeenButton
      titleId={title.id}
      titleName={title.name}
      rating={title.rating}
      review={title.review}
      size={size}
      onSaved={onMarkedSeen}
      onError={onMarkSeenError}
    />
    <PosterPlatformBadge
      watchProvidersMx={title.watchProvidersMx}
      preferredPlatforms={preferredPlatforms}
      size={size}
    />
  </div>
);

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
