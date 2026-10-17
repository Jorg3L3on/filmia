"use client";

import Link from "next/link";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { useCineActions } from "@/components/cine/CineActions";
import { PosterImage } from "@/components/PosterImage";
import type { CineFilm } from "@/lib/cine";
import { cn } from "@/lib/cn";
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
};

/** A Cine poster: tap → ficha, hold (or right click) → the Buscar menu anchored on it. */
export const CinePoster = ({ film, badge, caption, dim = false, className, sizes = "(max-width: 640px) 34vw, 180px", priority }: CinePosterProps) => {
  const { hrefFor, statusOf, openMenu } = useCineActions();
  const frameRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);
  const status = statusOf(film);

  const open = () => {
    const node = frameRef.current;
    if (!node) {
      return;
    }
    firedRef.current = true;
    navigator.vibrate?.(8);
    openMenu(film, node.getBoundingClientRect());
  };
  const longPress = useLongPress(open);

  return (
    <article className={cn("min-w-0", dim && "opacity-55 saturate-50", className)}>
      <Link
        href={hrefFor(film)}
        prefetch={false}
        aria-label={`${film.name}${film.year ? ` (${film.year})` : ""}${status === "watched" ? ", vista" : status === "watchlist" ? ", en Quiero ver" : ""}`}
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
          open();
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
                "absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-md",
                status === "watched" ? "bg-success/85 text-ink" : "bg-ink/70 text-accent-hover",
              )}
            >
              {status === "watched" ? "Vista" : "Quiero ver"}
            </span>
          ) : null}
        </div>
        <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-snug text-paper group-hover:text-cine">{film.name}</p>
        {caption ? <p className="mt-0.5 text-xs text-mist">{caption}</p> : null}
      </Link>
    </article>
  );
};

/** «Estreno» on a film's first week in theaters. */
export const PremiereTag = () => (
  <span className="rounded-full bg-cine px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink shadow-[0_0_12px_rgb(var(--cine-rgb)/0.6)]">
    Estreno
  </span>
);
