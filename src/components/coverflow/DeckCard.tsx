"use client";

import Link from "next/link";
import { memo, useRef, useState, type CSSProperties } from "react";
import { MarkSeenEye } from "@/components/MarkSeenEye";
import { TicketStub } from "@/components/tonight/TicketStub";
import { useTonight } from "@/components/tonight/TonightContext";
import { flyPosterToProfile } from "@/lib/fly-to-nav";
import { useLongPress } from "@/lib/motion";
import { tmdbPosterUrl } from "@/lib/tmdb";
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
  /** Esta noche: the stub tore — fire the sala light leak. */
  onStubCommit?: () => void;
};

const STAMP_MS = 520;

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
  onStubCommit,
}: DeckCardProps) {
  const sala = useTonight();
  const tonight = title.tonight;
  const isTonight = Boolean(tonight && sala && cinematic && !compact);
  const [stamped, setStamped] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const longPress = useLongPress(() => {
    if (isTonight && sala) {
      sala.onOpenMenu(title);
    }
  });
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
    rootRef.current = node;
    registerNode(index, node);
  };

  const handleStubSaved = () => {
    setStamped(true);
    onMarkedSeen?.(title.id);
    window.setTimeout(() => {
      void flyPosterToProfile(rootRef.current, tmdbPosterUrl(title.posterPath, "w185")).then(
        () => sala?.onWatched(title),
      );
    }, STAMP_MS);
  };

  const handleStubError = (message: string) => {
    setStamped(false);
    onMarkSeenError?.(title.id);
    sala?.onWatchError(title, message);
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
        isTonight && "is-tonight",
        stamped && "is-stamped",
      )}
      onPointerDown={(event) => {
        onPointerDown(event);
        if (isTonight) {
          longPress.onPointerDown(event);
        }
      }}
      onPointerMove={isTonight ? longPress.onPointerMove : undefined}
      onPointerUp={isTonight ? longPress.onPointerUp : undefined}
      onPointerCancel={isTonight ? longPress.onPointerCancel : undefined}
      onPointerLeave={isTonight ? longPress.onPointerLeave : undefined}
      onContextMenu={
        isTonight
          ? (event) => {
              event.preventDefault();
              sala?.onOpenMenu(title);
            }
          : undefined
      }
    >
      <Link
        href={`/titulos/${title.id}`}
        tabIndex={nearFocus ? 0 : -1}
        aria-label={`${title.name}${title.year ? ` (${title.year})` : ""}${
          availabilityLabel ? ` en ${availabilityLabel}` : ""
        }`}
        onClick={(event) => {
          handleClick(event);
          if (isTonight && !event.defaultPrevented) {
            sala?.onOpened(title);
          }
        }}
        onDragStart={handleDragStart}
        data-coverflow-face
        style={{ "--deal-i": index } as CSSProperties}
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
        {!compact && title.watched && !isTonight ? (
          <WatchedBadge
            compact
            className={cn(
              "absolute z-10",
              cinematic && imdbLabel
                ? "bottom-2.5 left-2.5"
                : "left-2 top-2",
            )}
          />
        ) : null}
        {stamped ? (
          <span className="visto-stamp" aria-hidden="true">
            Visto
          </span>
        ) : null}
        {cinematic && !isTonight && imdbLabel && title.imdbRating != null ? (
          <span
            data-deck-imdb-badge
            aria-label={imdbLabel}
            className="pointer-events-none absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-black/85 px-2 py-0.5 text-[11px] font-semibold leading-none text-white shadow-[0_2px_8px_rgba(0,0,0,0.45)] ring-1 ring-white/15 backdrop-blur-[2px]"
          >
            <span className="text-[10px] text-star" aria-hidden>
              ★
            </span>
            <span>
              IMDb {title.imdbRating.toFixed(1)}
            </span>
          </span>
        ) : null}
        {cinematic && availabilityPlatform ? (
          <span
            data-deck-platform-badge
            aria-hidden
            className="pointer-events-none absolute right-2.5 top-2.5 z-10"
          >
            <PlatformLogo
              platform={availabilityPlatform}
              size={22}
              className="rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.4)] ring-1 ring-white/25"
            />
          </span>
        ) : null}
        {!cinematic &&
        !compact &&
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
      {isTonight && !title.watched ? (
        <TicketStub
          titleId={title.id}
          titleName={title.name}
          rating={title.rating}
          review={title.review}
          onCommit={onStubCommit}
          onSaved={handleStubSaved}
          onError={handleStubError}
        />
      ) : null}
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
