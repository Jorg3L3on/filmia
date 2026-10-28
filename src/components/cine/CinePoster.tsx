"use client";

import Link from "next/link";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { useCineActions } from "@/components/cine/CineActions";
import { PosterImage } from "@/components/PosterImage";
import { TmdbPersonAvatar } from "@/components/TmdbPersonAvatar";
import type { CineFilm } from "@/lib/cine";
import { directedByLabel, shortDirectorName } from "@/lib/cine-directors";
import { cn } from "@/lib/cn";
import { menuVia } from "@/components/tmdb-search/SearchRowMenu";
import { useLongPress } from "@/lib/motion";
import { focusRing, posterFrame } from "@/lib/ui";

type CinePosterProps = {
  film: CineFilm;
  /** Over the poster, top-left: «Estreno», a platform logo… */
  badge?: ReactNode;
  /** Under the title: «6 nov», «Netflix»… */
  caption?: ReactNode;
  /** «Ya en casa» on someone else's platforms. */
  dim?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** Próximamente's narrow tiles: the director's avatar drops to 24 px. */
  compact?: boolean;
};

/** A Cine poster: tap → ficha, hold (or right click) → the Buscar menu anchored on it. */
export const CinePoster = ({
  film,
  badge,
  caption,
  dim = false,
  className,
  sizes = "(max-width: 640px) 34vw, 180px",
  priority,
  compact = false,
}: CinePosterProps) => {
  const { hrefFor, statusOf, openMenu } = useCineActions();
  const frameRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);
  const status = statusOf(film);

  const open = (pointerType: string) => {
    const node = frameRef.current;
    if (!node) {
      return;
    }
    firedRef.current = true;
    navigator.vibrate?.(8);
    openMenu(film, node.getBoundingClientRect(), menuVia(pointerType));
  };
  const longPress = useLongPress(open);

  return (
    <article className={cn("min-w-0", dim && "opacity-55 saturate-50", className)}>
      <Link
        href={hrefFor(film)}
        prefetch={false}
        aria-label={`${film.name}${film.year ? ` (${film.year})` : ""}${directedByLabel(film.directors)}${status === "watched" ? ", vista" : status === "watchlist" ? ", en Quiero ver" : ""}`}
        className={cn("group block select-none [-webkit-touch-callout:none]", focusRing)}
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
        <div ref={frameRef} className={cn(posterFrame, "card-physics press-scale relative")}>
          <PosterImage name={film.name} posterPath={film.posterPath} sizes={sizes} priority={priority} />
          {badge ? <div className="absolute left-1.5 top-1.5 flex items-center gap-1">{badge}</div> : null}
          {status ? (
            <span
              className={cn(
                "absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-md",
                status === "watched" ? "bg-success/85 text-ink" : "bg-ink/70 text-accent-hover",
              )}
            >
              {status === "watchlist" && film.status === "upcoming" ? <BellGlyph /> : null}
              {status === "watched" ? "Vista" : "Quiero ver"}
            </span>
          ) : null}
        </div>
        <p title={film.name} className="mt-2 line-clamp-2 text-[13px] font-medium leading-snug text-paper group-hover:text-cine">
          {film.name}
        </p>
        <DirectorCredit directors={film.directors} compact={compact} />
        {caption ? <p className="mt-0.5 text-xs text-mist">{caption}</p> : null}
      </Link>
    </article>
  );
};

/**
 * Option B of FIL-IDEA4: the first director's avatar (a «+N» badge for the
 * others), «Dirección» and «D. Villeneuve». Part of the tile's link, never a
 * link of its own; nothing at all when the director is unknown.
 */
const DirectorCredit = ({ directors, compact }: { directors: CineFilm["directors"]; compact: boolean }) => {
  const first = directors[0];
  if (!first) {
    return null;
  }
  const more = directors.length - 1;
  return (
    <div aria-hidden="true" className="mt-1.5 flex min-w-0 items-center gap-1.5">
      <span className="relative shrink-0">
        <TmdbPersonAvatar personId={first.id} name={first.name} profilePath={first.profilePath} size={compact ? 24 : 28} />
        {more > 0 ? (
          <span className="absolute -bottom-1 -right-1.5 rounded-full bg-chrome px-1 text-[9px] font-semibold leading-[14px] tabular-nums text-paper ring-1 ring-canvas">
            +{more}
          </span>
        ) : null}
      </span>
      <span className={cn("min-w-0 leading-tight", more > 0 && "pl-1")}>
        <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-mist">Dirección</span>
        <span className="block truncate text-[11px] text-fog">{shortDirectorName(first.name)}</span>
      </span>
    </div>
  );
};

/** «Hoy» on the premiere day, «Estreno» for the three days after (premiereTag). */
export const PremiereTag = ({ label = "Estreno" }: { label?: "Hoy" | "Estreno" }) => (
  <span className="rounded-full bg-cine px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink shadow-[0_0_12px_rgb(var(--cine-rgb)/0.6)]">
    {label}
  </span>
);

/** On an upcoming film in Quiero ver: the corner says it will warn you («Llega a cines»). */
const BellGlyph = () => (
  <svg viewBox="0 0 24 24" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <title>te avisamos</title>
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
