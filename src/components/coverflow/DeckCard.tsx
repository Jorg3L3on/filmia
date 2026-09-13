"use client";

import Link from "next/link";
import { memo } from "react";
import { MarkSeenEye } from "@/components/MarkSeenEye";
import { PlatformLogo } from "@/components/PlatformLogo";
import { PosterImage } from "@/components/PosterImage";
import { SharedPoster } from "@/components/SharedPoster";
import { SeriesStatusBadge } from "@/components/SeriesStatusBadge";
import { WatchedBadge } from "@/components/WatchedBadge";
import { WatchProviderChips } from "@/components/WatchProvidersMx";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { cn } from "@/lib/cn";
import {
  COVERFLOW_PAGE_POSTER_SIZES,
  COVERFLOW_SHEET_POSTER_SIZES,
} from "@/lib/coverflow-metrics";
import {
  formatImdbRating,
  formatRating,
  PLATFORM_SERVICE_LABEL,
  TITLE_KIND_LABEL,
} from "@/lib/labels";
import { PICKS_SAVE_LABEL } from "@/lib/mark-seen";
import { primaryAvailabilityPlatform } from "@/lib/streaming-platforms";
import type { Platform } from "@/db";

const DeckAvailabilityMark = ({
  title,
  platform,
}: {
  title: CoverflowTitle;
  platform: Platform | null;
}) => {
  if (platform) {
    return (
      <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
        <PlatformLogo
          platform={platform}
          size={20}
          className="ring-1 ring-white/25"
        />
        <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-white">
          {PLATFORM_SERVICE_LABEL[platform]}
        </span>
      </div>
    );
  }

  const provider = title.flatrateProviders?.[0];
  if (!provider) {
    return null;
  }

  return (
    <WatchProviderChips
      providers={[provider]}
      max={1}
      className="mb-1.5 justify-start"
    />
  );
};

type DeckCardProps = {
  title: CoverflowTitle;
  index: number;
  compact?: boolean;
  nearFocus?: boolean;
  /** Qué ver cinematic: hide on-poster caption (meta lives below). */
  cinematic?: boolean;
  showMarkSeenEye?: boolean;
  onSelect: (index: number) => void;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  registerNode: (index: number, node: HTMLElement | null) => void;
  onMarkedSeen?: (titleId: string) => void;
  onMarkSeenError?: (titleId: string) => void;
};

export const DeckCard = memo(function DeckCard({
  title,
  index,
  compact = false,
  nearFocus = false,
  cinematic = false,
  showMarkSeenEye = false,
  onSelect,
  onPointerDown,
  registerNode,
  onMarkedSeen,
  onMarkSeenError,
}: DeckCardProps) {
  const imdbLabel = formatImdbRating(title.imdbRating);
  const availabilityPlatform = primaryAvailabilityPlatform(
    title.flatrateProviders,
    title.platform,
  );
  const availabilityLabel = availabilityPlatform
    ? PLATFORM_SERVICE_LABEL[availabilityPlatform]
    : title.flatrateProviders?.[0]?.name;
  const posterSizes = compact
    ? COVERFLOW_SHEET_POSTER_SIZES
    : COVERFLOW_PAGE_POSTER_SIZES;
  const showCaption = !compact && !cinematic;
  const poster = (
    <PosterImage
      name={title.name}
      posterPath={title.posterPath}
      priority={nearFocus}
      sizes={posterSizes}
      className="absolute inset-0 h-full w-full rounded-none [aspect-ratio:auto]"
    />
  );

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const selected = event.currentTarget.closest("article")?.classList.contains("is-focused");
    if (selected) {
      return;
    }

    event.preventDefault();
    onSelect(index);
  };

  const handleDragStart = (event: React.DragEvent<HTMLAnchorElement>) => {
    event.preventDefault();
  };

  const handleRef = (node: HTMLElement | null) => {
    registerNode(index, node);
  };

  return (
    <article
      ref={handleRef}
      id={`coverflow-item-${title.id}`}
      role="option"
      aria-selected={nearFocus}
      className={cn(
        "coverflow-card absolute inset-0 origin-center",
        compact && "is-compact",
        cinematic && "is-cinematic",
      )}
      onPointerDown={onPointerDown}
    >
      <Link
        href={`/titulos/${title.id}`}
        tabIndex={nearFocus ? 0 : -1}
        aria-label={`${title.name}${title.year ? ` (${title.year})` : ""}${
          availabilityLabel ? ` en ${availabilityLabel}` : ""
        }`}
        onClick={handleClick}
        onDragStart={handleDragStart}
        data-coverflow-face
        className={cn(
          "coverflow-card-face relative block h-full cursor-inherit overflow-hidden bg-surface [&_img]:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          cinematic
            ? "rounded-[22px] border-0"
            : "rounded-poster border",
        )}
        draggable={false}
      >
        {compact ? (
          poster
        ) : (
          <SharedPoster titleId={title.id} className="absolute inset-0">
            {poster}
          </SharedPoster>
        )}
        <span data-coverflow-dim className="coverflow-card-dim" aria-hidden />
        <span className="coverflow-card-specular" aria-hidden />
        {!compact && title.watched ? (
          <WatchedBadge compact className="absolute left-2 top-2 z-10" />
        ) : null}
        {!compact &&
        title.kind === "SERIES" &&
        title.seriesStatus &&
        !(showMarkSeenEye && !title.watched) ? (
          <SeriesStatusBadge
            status={title.seriesStatus}
            compact
            className="absolute right-2 top-2 z-10"
          />
        ) : null}
        {showCaption ? (
          <div
            data-coverflow-caption
            className="coverflow-card-caption absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-3 pt-10"
          >
            <DeckAvailabilityMark title={title} platform={availabilityPlatform} />
            <p className="truncate text-[10px] uppercase tracking-wider text-white/70">
              {TITLE_KIND_LABEL[title.kind]}
              {title.year ? ` · ${title.year}` : ""}
            </p>
            <p className="truncate font-serif text-sm leading-tight text-white">
              {title.name}
            </p>
            <p className="truncate text-xs text-star">
              {formatRating(title.rating)}
              {imdbLabel ? ` · ${imdbLabel}` : ""}
            </p>
          </div>
        ) : null}
      </Link>
      {showMarkSeenEye && !title.watched ? (
        <MarkSeenEye
          titleId={title.id}
          titleName={title.name}
          rating={title.rating}
          review={title.review}
          size={compact ? "queue" : "hero"}
          saveLabel={PICKS_SAVE_LABEL}
          onSaved={() => onMarkedSeen?.(title.id)}
          onError={() => onMarkSeenError?.(title.id)}
        />
      ) : null}
    </article>
  );
});
