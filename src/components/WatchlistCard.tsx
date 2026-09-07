"use client";

import Link from "next/link";
import { ImdbBadge } from "@/components/ImdbBadge";
import { ListItemOrderControls } from "@/components/ListItemOrderControls";
import { PosterImage } from "@/components/PosterImage";
import { PosterPlatformBadge } from "@/components/PosterPlatformBadge";
import { SharedPoster } from "@/components/SharedPoster";
import { WatchlistMarkSeenButton } from "@/components/WatchlistMarkSeenButton";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import type { TitleWithRelations } from "@/lib/queries";
import { compactGenreLabel, titleSynopsis } from "@/lib/title-overview";
import { btnGhost, focusRing } from "@/lib/ui";
import type { ListItem, Platform } from "@/db";

type WatchlistItem = ListItem & {
  title: TitleWithRelations;
};

type WatchlistCardProps = {
  item: WatchlistItem;
  variant: "hero" | "queue";
  position: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  pendingOrder?: boolean;
  removeAction: () => void | Promise<void>;
  onMove: (direction: "up" | "down") => void;
  onMarkedSeen?: () => void;
  onMarkSeenError?: () => void;
  preferredPlatforms?: readonly Platform[];
};

export const WatchlistCard = ({
  item,
  variant,
  position,
  canMoveUp,
  canMoveDown,
  pendingOrder = false,
  removeAction,
  onMove,
  onMarkedSeen,
  onMarkSeenError,
  preferredPlatforms = [],
}: WatchlistCardProps) => {
  const { title } = item;
  const yearLabel = title.year ? String(title.year) : TITLE_KIND_LABEL[title.kind];

  if (variant === "hero") {
    return (
      <article className="card-physics overflow-hidden rounded-card border border-line bg-surface p-4 sm:p-5">
        <div className="flex gap-4">
          <WatchlistPoster
            title={title}
            size="hero"
            className="isolate z-0 w-[112px] shrink-0 sm:w-[140px]"
            posterClassName="rounded-poster"
            sizes="140px"
            preferredPlatforms={preferredPlatforms}
            priority
            onMarkedSeen={onMarkedSeen}
            onMarkSeenError={onMarkSeenError}
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-ink">
                {position}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mist">
                  Próxima en tu lista
                </p>
                <h2 className="font-serif text-2xl leading-tight text-paper sm:text-3xl">
                  <Link href={`/titulos/${title.id}`} className={`hover:text-accent ${focusRing}`}>
                    {title.name}
                  </Link>
                </h2>
                <p className="text-sm text-fog">
                  {yearLabel}
                  {title.year ? ` · ${TITLE_KIND_LABEL[title.kind]}` : ""}
                </p>
              </div>
            </div>
            {item.queueNote ? (
              <p className="line-clamp-3 text-sm text-fog">
                <span className="mr-2 text-mist">Nota personal</span>
                {item.queueNote}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ListItemOrderControls
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                pending={pendingOrder}
                onMove={onMove}
              />
              <button type="button" onClick={removeAction} className={btnGhost}>
                Quitar
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  const synopsis = titleSynopsis(title.overview);
  const genreLabel = compactGenreLabel(title.tmdbGenres);

  return (
    <article className="flex items-center gap-3 rounded-2xl px-1 py-2">
      <span className="w-5 shrink-0 text-center text-sm font-semibold text-mist">
        {position}
      </span>
      <WatchlistPoster
        title={title}
        size="queue"
        className="isolate z-0 w-14 shrink-0"
        posterClassName="rounded-lg"
        sizes="56px"
        preferredPlatforms={preferredPlatforms}
        onMarkedSeen={onMarkedSeen}
        onMarkSeenError={onMarkSeenError}
      />
      <div className="min-w-0 w-[8.5rem] shrink-0 sm:w-[13rem]">
        <h3 className="truncate font-medium text-paper">
          <Link href={`/titulos/${title.id}`} className={`hover:text-accent ${focusRing}`}>
            {title.name}
          </Link>
        </h3>
        <p className="truncate text-sm text-fog">
          {genreLabel ? `${yearLabel} · ${genreLabel}` : yearLabel}
        </p>
        <ImdbBadge rating={title.imdbRating} compact />
      </div>
      {synopsis ? (
        <p className="hidden min-w-0 flex-1 line-clamp-2 text-sm leading-5 text-fog sm:block">
          {synopsis}
        </p>
      ) : null}
      <ListItemOrderControls
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        pending={pendingOrder}
        onMove={onMove}
      />
    </article>
  );
};

const WatchlistPoster = ({
  title,
  size,
  className,
  posterClassName,
  sizes,
  preferredPlatforms = [],
  priority = false,
  onMarkedSeen,
  onMarkSeenError,
}: {
  title: WatchlistItem["title"];
  size: "hero" | "queue";
  className: string;
  posterClassName: string;
  sizes: string;
  preferredPlatforms?: readonly Platform[];
  priority?: boolean;
  onMarkedSeen?: () => void;
  onMarkSeenError?: () => void;
}) => (
  <div className={cn("relative", className)}>
    <Link
      href={`/titulos/${title.id}`}
      aria-label={title.name}
      className={cn("block", focusRing)}
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
