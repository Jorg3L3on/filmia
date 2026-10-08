"use client";

import Link from "next/link";
import { PlatformLogo } from "@/components/PlatformLogo";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { cn } from "@/lib/cn";
import { formatStarScore, PLATFORM_SERVICE_LABEL, TITLE_KIND_LABEL } from "@/lib/labels";
import { primaryAvailabilityPlatform } from "@/lib/streaming-platforms";
import { focusRing } from "@/lib/ui";

type ListDeckFooterProps = {
  title: CoverflowTitle;
  className?: string;
  /** Opens the card menu (Ver ficha · Mover · Quitar). Absent on automatic lists. */
  onOpenMenu?: (title: CoverflowTitle) => void;
};

/** List deck footer in the Esta noche voice: serif title, meta line, decision chips. */
export const ListDeckFooter = ({ title, className, onOpenMenu }: ListDeckFooterProps) => {
  const genreNames = (title.genres ?? []).map((genre) => genre.name).filter(Boolean).slice(0, 3);
  const metaParts: string[] = [];
  if (title.year) {
    metaParts.push(String(title.year));
  }
  if (title.kind === "SERIES") {
    metaParts.push(TITLE_KIND_LABEL.SERIES);
  }
  metaParts.push(...(genreNames.length > 0 ? genreNames : [TITLE_KIND_LABEL[title.kind]]));

  const platform = primaryAvailabilityPlatform(title.flatrateProviders, title.platform);
  const platformLabel = platform
    ? PLATFORM_SERVICE_LABEL[platform]
    : (title.flatrateProviders?.[0]?.name ?? null);

  return (
    <div
      className={cn(
        "tonight-footer mx-auto flex w-full max-w-xl flex-col items-center gap-2.5 text-center",
        // The «Vi esto» stub hangs ~30px under unwatched cards: keep it off the title.
        !title.watched && "pt-8",
        className,
      )}
    >
      <div key={title.id} className="tonight-title-in space-y-1 px-2">
        <h2 className="tonight-title font-serif text-[1.55rem] font-semibold leading-tight text-paper sm:text-3xl md:text-4xl">
          <Link href={`/titulos/${title.id}`} className={cn("hover:text-accent", focusRing)}>
            {title.name}
          </Link>
        </h2>
        <p className="tonight-meta text-[13px] font-medium text-paper/85 sm:text-sm">
          {metaParts.map((part, index) => (
            <span key={`${part}-${index}`}>
              {index > 0 ? <span className="text-paper/70"> · </span> : null}
              <span>{part}</span>
            </span>
          ))}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        {title.rating != null ? (
          <span className="tonight-chip" title="Tu nota">
            <span className="text-star" aria-hidden="true">★</span>
            <span className="font-semibold">{formatStarScore(title.rating)}</span>
            <span className="sr-only">estrellas, tu nota</span>
          </span>
        ) : null}
        {title.imdbRating != null ? (
          <span className="tonight-chip" title={`IMDb ${title.imdbRating.toFixed(1)}/10`}>
            <span className="tonight-chip-imdb">IMDb</span>
            <span className="font-semibold text-imdb">{title.imdbRating.toFixed(1)}</span>
          </span>
        ) : null}
        {platformLabel ? (
          <span className="tonight-chip">
            {platform ? <PlatformLogo platform={platform} size={16} className="rounded-[4px]" /> : null}
            {platformLabel}
          </span>
        ) : null}
        {onOpenMenu ? (
          <button
            type="button"
            onClick={() => onOpenMenu(title)}
            aria-label={`Más opciones de ${title.name}`}
            aria-haspopup="dialog"
            className={cn("tonight-chip press-scale w-10 justify-center px-0 text-paper hover:bg-white/10", focusRing)}
          >
            <MoreIcon />
          </button>
        ) : null}
      </div>
    </div>
  );
};

const MoreIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <circle cx="5.5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="18.5" cy="12" r="1.9" />
  </svg>
);
