import Image from "next/image";
import type { CSSProperties } from "react";
import { ImdbBadge } from "@/components/ImdbBadge";
import { PosterImage } from "@/components/PosterImage";
import { SharedPoster } from "@/components/SharedPoster";
import { LaurelIcon } from "@/components/watchlist/icons";
import { cn } from "@/lib/cn";
import { formatStarScore } from "@/lib/labels";
import { posterFrame } from "@/lib/ui";

type TitleHeroProps = {
  titleId: string;
  name: string;
  originalName?: string | null;
  posterPath?: string | null;
  backdropSrc?: string | null;
  year?: number | null;
  runtimeLabel?: string | null;
  kindLabel: string;
  genreLabel?: string | null;
  imdbRating?: number | null;
  awardLabel?: string | null;
  rating?: number | null;
  watched: boolean;
  /** Catalog.posterAmbient («r g b»): the poster's light on the backdrop. */
  posterAmbient?: string | null;
};

const ambientStyle = (posterAmbient: string | null | undefined) =>
  posterAmbient && /^\d{1,3} \d{1,3} \d{1,3}$/.test(posterAmbient)
    ? ({ "--ficha-glow": posterAmbient } as CSSProperties)
    : undefined;

/**
 * Ficha hero, dirección A «Cartel» (FIL-I4-1): full-bleed backdrop with the
 * poster's light, the poster centred (it is the `poster-{id}` morph target),
 * serif title and the cartelera's chips. Grid items of `.ficha-head`: on
 * desktop the poster sits left and the text right.
 */
export const TitleHero = ({
  titleId,
  name,
  originalName,
  posterPath,
  backdropSrc,
  year,
  runtimeLabel,
  kindLabel,
  genreLabel,
  imdbRating,
  awardLabel,
  rating,
  watched,
  posterAmbient,
}: TitleHeroProps) => {
  const restBits = [runtimeLabel, kindLabel, genreLabel].filter(Boolean);

  return (
    <>
      <div className="ficha-backdrop-a" aria-hidden="true">
        {backdropSrc ? (
          <Image
            src={backdropSrc}
            alt=""
            fill
            sizes="100vw"
            className="ficha-backdrop-a-img object-cover object-[center_25%]"
            fetchPriority="low"
          />
        ) : null}
        <div className="ficha-backdrop-a-shade" />
      </div>

      {/* No entrance of its own: the poster-{id} morph from the tile is its entrance. */}
      <div className="ficha-poster-a" style={ambientStyle(posterAmbient)}>
        <SharedPoster titleId={titleId} className="block w-[42vw] max-w-[168px] sm:w-[280px] sm:max-w-none">
          <PosterImage
            name={name}
            posterPath={posterPath}
            className={`${posterFrame} shadow-[0_28px_64px_rgba(0,0,0,0.72)] ring-1 ring-white/10`}
            priority
            fetchPriority="high"
            sizes="(max-width: 640px) 42vw, 280px"
          />
        </SharedPoster>
      </div>

      <header className="ficha-info-a">
        <p className="ficha-enter text-[13px] text-fog" style={{ "--i": 1 } as CSSProperties}>
          {year ? <span className="font-semibold text-accent">{year}</span> : null}
          {year && restBits.length > 0 ? " · " : null}
          {restBits.join(" · ")}
        </p>
        <h1
          className="ficha-enter font-serif text-[2.625rem] leading-[1.05] tracking-[-0.02em] text-paper sm:text-7xl sm:leading-[0.98]"
          style={{ "--i": 2 } as CSSProperties}
        >
          {name}
        </h1>
        {originalName && originalName !== name ? (
          <p className="ficha-enter text-[13px] text-fog" style={{ "--i": 3 } as CSSProperties}>
            {originalName}
          </p>
        ) : null}
        <div
          className="ficha-enter flex flex-wrap items-center justify-center gap-2 pt-1.5 sm:justify-start"
          style={{ "--i": 3 } as CSSProperties}
        >
          {imdbRating != null ? (
            <span className="liquid-glass liquid-glass-pill relative inline-flex h-7 items-center rounded-full pl-1 pr-2.5">
              <ImdbBadge rating={imdbRating} compact />
            </span>
          ) : null}
          {awardLabel ? (
            <span className="inline-flex h-7 max-w-full items-center gap-1 truncate rounded-full border border-star/35 bg-star/10 px-2.5 text-xs font-medium text-star">
              <LaurelIcon />
              <span className="truncate">{awardLabel}</span>
            </span>
          ) : null}
          {rating != null ? (
            <span className="liquid-glass liquid-glass-pill relative inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-star">
              <StarGlyph />
              {formatStarScore(rating)}
              <span className="font-normal text-fog">· Tu nota</span>
            </span>
          ) : null}
          {watched ? (
            <span
              className={cn(
                "inline-flex h-7 items-center rounded-full border border-success/40 bg-success-well px-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-success",
              )}
            >
              Visto
            </span>
          ) : null}
        </div>
      </header>
    </>
  );
};

const StarGlyph = () => (
  <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
    <path d="m12 4.5 2.1 4.4 4.8.6-3.5 3.3.9 4.8L12 15.4 7.7 17.6l.9-4.8-3.5-3.3 4.8-.6Z" />
  </svg>
);
