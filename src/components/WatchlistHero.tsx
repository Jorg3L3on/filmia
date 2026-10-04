"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePosterAmbientColor } from "@/components/coverflow/usePosterAmbientColor";
import { ImdbBadge } from "@/components/ImdbBadge";
import { MarkWatchedSheet } from "@/components/MarkWatchedSheet";
import { PlatformLogo } from "@/components/PlatformLogo";
import { PosterImage } from "@/components/PosterImage";
import { SharedPoster } from "@/components/SharedPoster";
import type { WatchlistItem } from "@/components/watchlist-types";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import { PLATFORM_SERVICE_LABEL, TITLE_KIND_LABEL } from "@/lib/labels";
import { resolvePosterAvailabilityBadge } from "@/lib/streaming-platforms";
import { tmdbBackdropUrl, tmdbPosterUrl } from "@/lib/tmdb";
import { compactGenreLabel, titleSynopsis } from "@/lib/title-overview";
import { focusRing, pillActionClass } from "@/lib/ui";

type WatchlistHeroProps = {
  item: WatchlistItem;
  preferredPlatforms?: readonly Platform[];
  onRemove: () => void;
  onMarkedSeen: () => void;
  onMarkSeenError: () => void;
};

export const WatchlistHero = ({
  item,
  preferredPlatforms = [],
  onRemove,
  onMarkedSeen,
  onMarkSeenError,
}: WatchlistHeroProps) => {
  const { title } = item;
  const [isMarking, setIsMarking] = useState(false);
  const ambient = usePosterAmbientColor(title.posterPath);
  const backdropSrc =
    tmdbBackdropUrl(title.backdropPath, "w1280") ?? tmdbPosterUrl(title.posterPath, "w500");
  const synopsis = titleSynopsis(title.overview);
  const genreLabel = compactGenreLabel(title.tmdbGenres);
  const badge = resolvePosterAvailabilityBadge(title.watchProvidersMx, preferredPlatforms);
  const platformLabel = badge?.platform
    ? PLATFORM_SERVICE_LABEL[badge.platform]
    : (badge?.firstProvider?.name ?? null);
  const metaParts = [
    title.year ? String(title.year) : null,
    TITLE_KIND_LABEL[title.kind],
    genreLabel,
  ].filter(Boolean);

  return (
    <article
      style={ambient.style}
      className="relative isolate -mx-4 overflow-hidden border-y border-line/60 sm:mx-0 sm:rounded-card sm:border"
    >
      {backdropSrc ? (
        <Image
          src={backdropSrc}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 1152px, 100vw"
          className={cn(
            "-z-20 object-cover opacity-55",
            !title.backdropPath && "scale-125 blur-2xl",
          )}
        />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_90%_60%_at_50%_30%,rgb(var(--que-ver-glow)/0.38),transparent_70%),linear-gradient(180deg,rgb(14_17_20/0.35)_0%,rgb(14_17_20/0.75)_45%,var(--color-canvas)_100%)]"
      />
      <div aria-hidden="true" className="que-ver-atmosphere-grain is-static -z-10" />

      <div className="flex flex-col items-center px-5 pb-6 pt-7 text-center sm:px-8 sm:pb-8 sm:pt-10">
        <Link
          href={`/titulos/${title.id}`}
          aria-label={title.name}
          className={cn("press-scale group relative block w-[min(44vw,210px)]", focusRing)}
        >
          <SharedPoster titleId={title.id}>
            <PosterImage
              name={title.name}
              posterPath={title.posterPath}
              sizes="220px"
              priority
              className="rounded-poster shadow-[0_24px_60px_rgb(var(--que-ver-glow)/0.35),0_12px_28px_rgba(0,0,0,0.6)] transition-[filter] duration-[var(--duration-hover)] group-hover:brightness-110"
            />
          </SharedPoster>
          <span className="absolute -left-3 -top-3 inline-flex size-10 items-center justify-center rounded-full bg-accent font-serif text-lg font-bold text-ink shadow-[0_8px_20px_rgba(0,0,0,0.45)]">
            1
          </span>
        </Link>

        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
          Próxima en tu lista
        </p>
        <h2 className="mt-2 text-balance font-serif text-[2.1rem] leading-[1.05] text-paper sm:text-5xl">
          <Link href={`/titulos/${title.id}`} className={cn("hover:text-accent", focusRing)}>
            {title.name}
          </Link>
        </h2>
        <p className="mt-2 text-sm text-fog">{metaParts.join(" · ")}</p>

        {title.imdbRating != null || platformLabel ? (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <ImdbBadge rating={title.imdbRating} />
            {platformLabel ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 py-1 pl-1 pr-3 text-sm text-paper backdrop-blur-md">
                {badge?.platform ? (
                  <PlatformLogo platform={badge.platform} size={20} className="rounded-full" />
                ) : null}
                {platformLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        {synopsis ? (
          <p className="mt-4 line-clamp-3 max-w-xl text-pretty text-sm leading-relaxed text-fog">
            {synopsis}
          </p>
        ) : null}
        {item.queueNote ? (
          <p className="mt-3 max-w-xl text-sm italic text-paper/85">«{item.queueNote}»</p>
        ) : null}

        <div className="mt-6 flex w-full max-w-sm items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setIsMarking(true)}
            className={cn(pillActionClass.primary, "h-12 flex-1 justify-center text-base")}
          >
            <EyeIcon />
            Vi esto
          </button>
          <Link
            href={`/titulos/${title.id}`}
            className={cn(pillActionClass.neutral, "h-12 flex-1 justify-center bg-black/30 text-base backdrop-blur-md")}
          >
            Ver ficha
          </Link>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Quitar ${title.name} de Quiero ver`}
            title="Quitar de Quiero ver"
            className={cn(
              "press-scale inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-chrome bg-black/30 text-fog backdrop-blur-md transition-colors duration-[var(--duration-hover)] hover:border-danger/50 hover:text-danger",
              focusRing,
            )}
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <MarkWatchedSheet
        open={isMarking}
        titleId={title.id}
        titleName={title.name}
        rating={title.rating}
        review={title.review}
        onClose={() => setIsMarking(false)}
        onSaved={onMarkedSeen}
        onError={onMarkSeenError}
      />
    </article>
  );
};

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="size-5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.8 12s3.4-6.4 9.2-6.4S21.2 12 21.2 12s-3.4 6.4-9.2 6.4S2.8 12 2.8 12Z"
    />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="size-5">
    <path strokeLinecap="round" d="M7 7l10 10M17 7 7 17" />
  </svg>
);
