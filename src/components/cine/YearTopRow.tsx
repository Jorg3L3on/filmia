"use client";

import Link from "next/link";
import { useRef, type PointerEvent } from "react";
import { useCineActions } from "@/components/cine/CineActions";
import { PosterImage } from "@/components/PosterImage";
import type { CineFilm } from "@/lib/cine";
import { cn } from "@/lib/cn";
import { menuVia } from "@/components/tmdb-search/SearchRowMenu";
import { useLongPress } from "@/lib/motion";
import { focusRing, posterFrame } from "@/lib/ui";

const ONE_DECIMAL = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

/** «478 mil votos», «1.2 M votos». */
export const formatVotes = (votes: number) =>
  votes >= 1_000_000
    ? `${ONE_DECIMAL.format(votes / 1_000_000)} M votos`
    : votes >= 1_000
      ? `${Math.round(votes / 1_000)} mil votos`
      : `${votes} votos`;

/** One line of «Lo mejor del año»: big rank, poster, IMDb rating and votes, «Vista». */
export const YearTopRow = ({
  rank,
  film,
  imdbRating,
  imdbVotes,
  watched,
}: {
  rank: number;
  film: CineFilm;
  imdbRating: number;
  imdbVotes: number;
  watched: boolean;
}) => {
  const { hrefFor, openMenu } = useCineActions();
  const rowRef = useRef<HTMLAnchorElement>(null);
  const firedRef = useRef(false);
  const open = (pointerType: string) => {
    if (!rowRef.current) {
      return;
    }
    firedRef.current = true;
    navigator.vibrate?.(8);
    openMenu(film, rowRef.current.getBoundingClientRect(), menuVia(pointerType));
  };
  const longPress = useLongPress(open);

  return (
    <Link
      ref={rowRef}
      href={hrefFor(film)}
      prefetch={false}
      className={cn(
        "group flex min-w-0 select-none items-center gap-3 rounded-2xl py-1.5 pr-2 transition-colors hover:bg-white/[0.03] [-webkit-touch-callout:none]",
        focusRing,
      )}
      onClickCapture={(event) => {
        if (firedRef.current) {
          firedRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        open("mouse");
        firedRef.current = false;
      }}
      {...longPress}
      onPointerDown={(event: PointerEvent) => {
        firedRef.current = false;
        longPress.onPointerDown(event);
      }}
    >
      <span
        className={cn(
          "w-11 shrink-0 text-right font-serif leading-none tabular-nums",
          rank < 10 ? "text-[2.1rem]" : rank < 100 ? "text-[1.75rem]" : "text-[1.4rem]",
          rank <= 3 ? "cine-glow text-cine" : "text-paper/35",
        )}
        aria-label={`Número ${rank}`}
      >
        {rank}
      </span>
      <div className={cn(posterFrame, "w-11 shrink-0")}>
        <PosterImage name={film.name} posterPath={film.posterPath} sizes="44px" tmdbSize="w185" />
      </div>
      <div className="min-w-0 flex-1">
        <p title={film.name} className="truncate text-[15px] font-medium text-paper group-hover:text-cine">
          {film.name}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-mist">
          <span className="rounded bg-imdb px-1 text-[10px] font-bold text-ink">IMDb</span>
          <span className="font-semibold text-paper">{imdbRating.toFixed(1)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatVotes(imdbVotes)}</span>
        </p>
      </div>
      {watched ? (
        <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">Vista</span>
      ) : null}
    </Link>
  );
};
