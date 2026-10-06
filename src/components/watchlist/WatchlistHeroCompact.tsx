"use client";

import Image from "next/image";
import Link from "next/link";
import { usePosterAmbientColor } from "@/components/coverflow/usePosterAmbientColor";
import { PosterImage } from "@/components/PosterImage";
import { SharedPoster } from "@/components/SharedPoster";
import { DotsIcon, EyeIcon } from "@/components/watchlist/icons";
import { WatchlistFichaChips } from "@/components/watchlist/WatchlistFichaChips";
import { WatchlistHookLine } from "@/components/watchlist/WatchlistHookLine";
import type { FichaView } from "@/components/watchlist/types";
import { cn } from "@/lib/cn";
import { tmdbBackdropUrl, tmdbPosterUrl } from "@/lib/tmdb";
import { focusRing, pillActionClass } from "@/lib/ui";

type WatchlistHeroCompactProps = {
  ficha: FichaView;
  stamped: boolean;
  onMarkSeen: (ficha: FichaView) => void;
  onMenu: (ficha: FichaView) => void;
};

/** #1 keeps its stage: backdrop, bigger poster, two-line synopsis, «Vi esto». */
export const WatchlistHeroCompact = ({ ficha, stamped, onMarkSeen, onMenu }: WatchlistHeroCompactProps) => {
  const ambient = usePosterAmbientColor(ficha.posterPath, ficha.posterAmbient);
  const backdropSrc =
    tmdbBackdropUrl(ficha.backdropPath, "w1280") ?? tmdbPosterUrl(ficha.posterPath, "w500");

  return (
    <article
      style={ambient.style}
      data-ficha={ficha.id}
      className={cn(
        "relative isolate -mx-4 overflow-hidden border-y border-line/60 sm:mx-0 sm:rounded-card sm:border",
        stamped && "ficha-row is-seen",
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu(ficha);
      }}
    >
      {backdropSrc ? (
        <Image
          src={backdropSrc}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 1152px, 100vw"
          className={cn("-z-20 object-cover opacity-55", !ficha.backdropPath && "scale-125 blur-2xl")}
        />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_90%_60%_at_50%_30%,rgb(var(--que-ver-glow)/0.38),transparent_70%),linear-gradient(180deg,rgb(14_17_20/0.35)_0%,rgb(14_17_20/0.75)_45%,var(--color-canvas)_100%)]"
      />
      <div aria-hidden="true" className="que-ver-atmosphere-grain is-static -z-10" />
      {stamped ? (
        <span className="visto-stamp" aria-hidden="true">
          Visto
        </span>
      ) : null}

      <div className="ficha-sheet flex gap-4 px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
        <Link
          href={`/titulos/${ficha.id}`}
          aria-label={ficha.name}
          className={cn("press-scale group relative block w-[min(30vw,132px)] shrink-0 self-start", focusRing)}
          data-ficha-poster={ficha.id}
        >
          <SharedPoster titleId={ficha.id}>
            <PosterImage
              name={ficha.name}
              posterPath={ficha.posterPath}
              sizes="140px"
              priority
              className="rounded-poster shadow-[0_24px_60px_rgb(var(--que-ver-glow)/0.35),0_12px_28px_rgba(0,0,0,0.6)] transition-[filter] duration-[var(--duration-hover)] group-hover:brightness-110"
            />
          </SharedPoster>
          <span className="absolute -left-2.5 -top-2.5 inline-flex size-9 items-center justify-center rounded-full bg-accent font-serif text-base font-bold text-ink shadow-[0_8px_20px_rgba(0,0,0,0.45)]">
            1
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
            Próxima en tu lista
          </p>
          <h2 className="mt-1 text-balance font-serif text-[1.65rem] leading-[1.05] text-paper sm:text-4xl">
            <Link href={`/titulos/${ficha.id}`} className={cn("hover:text-accent", focusRing)}>
              {ficha.name}
            </Link>
          </h2>
          <p className="mt-1.5 text-sm text-fog">
            {ficha.meta}
            {ficha.genres.length > 0 ? ` · ${ficha.genres.slice(0, 2).join(" · ")}` : ""}
          </p>
          <WatchlistFichaChips
            imdbRating={ficha.imdbRating}
            platform={ficha.platform}
            awardLabel={ficha.awardLabel}
            className="mt-2.5"
          />
          <WatchlistHookLine hook={ficha.hook} className="mt-2" />
          {ficha.overview ? (
            <p className="mt-2.5 line-clamp-2 text-pretty text-[13.5px] leading-relaxed text-fog">
              {ficha.overview}
            </p>
          ) : null}
        </div>
      </div>

      <div className="ficha-sheet flex items-center gap-2 px-4 pb-4 sm:px-6 sm:pb-5">
        <button
          type="button"
          onClick={() => onMarkSeen(ficha)}
          className={cn(pillActionClass.primary, "h-11 flex-1 justify-center")}
        >
          <EyeIcon />
          Vi esto
        </button>
        <Link
          href={`/titulos/${ficha.id}`}
          className={cn(pillActionClass.neutral, "h-11 flex-1 justify-center bg-black/30 backdrop-blur-md")}
        >
          Ver ficha
        </Link>
        <button
          type="button"
          onClick={() => onMenu(ficha)}
          aria-label={`Más opciones de ${ficha.name}`}
          className={cn(
            "press-scale inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-chrome bg-black/30 text-fog backdrop-blur-md transition-colors duration-[var(--duration-hover)] hover:text-paper",
            focusRing,
          )}
        >
          <DotsIcon />
        </button>
      </div>
    </article>
  );
};
