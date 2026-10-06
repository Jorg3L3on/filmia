"use client";

import Image from "next/image";
import Link from "next/link";
import { usePosterAmbientColor } from "@/components/coverflow/usePosterAmbientColor";
import { PosterImage } from "@/components/PosterImage";
import { SharedPoster } from "@/components/SharedPoster";
import { WatchlistFichaChips } from "@/components/watchlist/WatchlistFichaChips";
import { WatchlistFichaDetail } from "@/components/watchlist/WatchlistFichaDetail";
import { WatchlistHookLine } from "@/components/watchlist/WatchlistHookLine";
import type { FichaView } from "@/components/watchlist/types";
import { cn } from "@/lib/cn";
import { tmdbBackdropUrl, tmdbPosterUrl } from "@/lib/tmdb";
import { focusRing } from "@/lib/ui";

type WatchlistStageProps = {
  ficha: FichaView;
  onMarkSeen: (ficha: FichaView) => void;
  onTonight: (ficha: FichaView) => void;
  onMenu: (ficha: FichaView) => void;
};

const Key = ({ children }: { children: string }) => (
  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-white/15 bg-white/5 px-1 font-sans text-[11px] font-semibold text-[#aab2bb]">
    {children}
  </kbd>
);

/** Desktop: the selected ficha on a sticky stage beside the list (hover / ↑↓ / click). */
export const WatchlistStage = ({ ficha, onMarkSeen, onTonight, onMenu }: WatchlistStageProps) => {
  const ambient = usePosterAmbientColor(ficha.posterPath, ficha.posterAmbient);
  const backdropSrc =
    tmdbBackdropUrl(ficha.backdropPath, "w780") ?? tmdbPosterUrl(ficha.posterPath, "w500");

  return (
    <aside
      key={ficha.id}
      style={ambient.style}
      aria-label={`Ficha de ${ficha.name}`}
      className="fade-up relative isolate overflow-hidden rounded-[20px] border border-white/10 bg-surface/70 shadow-panel"
    >
      <div className="cartelera-stage-backdrop relative h-60 overflow-hidden">
        {backdropSrc ? (
          <Image
            src={backdropSrc}
            alt=""
            fill
            sizes="460px"
            className={cn("object-cover object-[center_35%]", !ficha.backdropPath && "scale-125 blur-2xl")}
          />
        ) : null}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_30%,rgb(var(--que-ver-glow)/0.3),transparent_70%)]"
        />
      </div>
      <div className="relative -mt-16 px-5 pb-5">
        <div className="flex items-end gap-4">
          <Link
            href={`/titulos/${ficha.id}`}
            aria-label={ficha.name}
            className={cn("press-scale block w-[104px] shrink-0", focusRing)}
          >
            <SharedPoster titleId={ficha.id} share={false}>
              <PosterImage
                name={ficha.name}
                posterPath={ficha.posterPath}
                sizes="104px"
                className="rounded-poster shadow-[0_24px_60px_rgb(var(--que-ver-glow)/0.35),0_12px_28px_rgba(0,0,0,0.6)]"
              />
            </SharedPoster>
          </Link>
          <div className="min-w-0 pb-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">#{ficha.rank} en tu lista</p>
            <h2 className="mt-1 text-balance font-serif text-3xl leading-[1.05] text-paper">
              <Link href={`/titulos/${ficha.id}`} className={cn("hover:text-accent", focusRing)}>
                {ficha.name}
              </Link>
            </h2>
            <p className="mt-1.5 text-[13px] text-fog">
              {ficha.meta}
              {ficha.genres.length > 0 ? ` · ${ficha.genres.join(" · ")}` : ""}
            </p>
          </div>
        </div>
        <WatchlistFichaChips
          imdbRating={ficha.imdbRating}
          platform={ficha.platform}
          awardLabel={ficha.awardLabel}
          className="mt-3.5"
        />
        <WatchlistHookLine hook={ficha.hook} className="mt-3" />
        <WatchlistFichaDetail
          ficha={ficha}
          fullSynopsis
          className="mt-3.5"
          onMarkSeen={() => onMarkSeen(ficha)}
          onTonight={() => onTonight(ficha)}
          onMenu={() => onMenu(ficha)}
        />
        <p className="mt-4 flex flex-wrap items-center gap-2 text-[11.5px] text-faint">
          <Key>↑</Key>
          <Key>↓</Key>
          recorrer
          <Key>↵</Key>
          ficha
          <Key>V</Key>
          vi esto
        </p>
      </div>
    </aside>
  );
};
