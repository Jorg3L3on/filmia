"use client";

import Link from "next/link";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { ImdbBadge } from "@/components/ImdbBadge";
import { PosterImage } from "@/components/PosterImage";
import { SharedPoster } from "@/components/SharedPoster";
import { LaurelIcon } from "@/components/watchlist/icons";
import { cn } from "@/lib/cn";
import { formatRuntime, TITLE_KIND_LABEL } from "@/lib/labels";
import { useLongPress } from "@/lib/motion";
import type { SearchResultFacts } from "@/lib/search-result-facts";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { focusRing, glassRowClass } from "@/lib/ui";

/** Where the title already is in the user's Filmia. */
export type SearchRowStatus = "watched" | "watchlist" | null;

type SearchResultRowProps = {
  result: TmdbCatalogResult;
  /** Local title id: the poster flies to the ficha (SharedPoster) when set. */
  titleId?: string | null;
  /** Extra meta after «año · tipo» (e.g. the character in a cast filmography). */
  detail?: ReactNode;
  status?: SearchRowStatus;
  /** IMDb, award, runtime and platform from the shared Catalog (FIL-I8-4); `pending` while it fills. */
  facts?: SearchResultFacts | null;
  /** The ficha: the user's own, or the preview by TMDB (FIL-I8). */
  href: string;
  /** Tap: the row is leaving for its ficha (Buscar remembers the query). */
  onOpen?: (result: TmdbCatalogResult) => void;
  /** Long press / right click: the shortcuts menu, anchored to this row. */
  onMenu?: (result: TmdbCatalogResult, anchor: DOMRect) => void;
};

/** How Buscar wires every row (results, filmographies): where it goes, what holding it does. */
export type SearchRowWiring = {
  hrefFor: (result: TmdbCatalogResult, titleId: string | null) => string;
  onOpen: (result: TmdbCatalogResult) => void;
  onMenu: (result: TmdbCatalogResult, anchor: DOMRect) => void;
  factsFor?: (result: TmdbCatalogResult) => SearchResultFacts | null;
};

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Poster key for the morph: the local title, else the film (the ficha preview uses the same). */
export const searchPosterKey = (result: Pick<TmdbCatalogResult, "kind" | "tmdbId">, titleId?: string | null) =>
  titleId && !titleId.startsWith("pending:") ? titleId : `tmdb-${result.kind}-${result.tmdbId}`;

/**
 * One Buscar result, «Fichas» direction with row A «Línea de datos» (FIL-I8):
 * glass row, serif title, «año · duración · tipo · género», then IMDb · premio ·
 * plataforma, and where it already lives in your Filmia. The whole row is the
 * link to the ficha; holding it opens the shortcuts.
 */
export const SearchResultRow = ({
  result,
  titleId,
  detail,
  status = null,
  facts = null,
  href,
  onOpen,
  onMenu,
}: SearchResultRowProps) => {
  const rowRef = useRef<HTMLAnchorElement>(null);
  const firedRef = useRef(false);
  const openMenu = () => {
    const node = rowRef.current;
    if (!onMenu || !node) {
      return;
    }
    firedRef.current = true;
    navigator.vibrate?.(8);
    onMenu(result, node.getBoundingClientRect());
  };
  const longPress = useLongPress(openMenu);

  return (
    <Link
      ref={rowRef}
      href={href}
      prefetch={false}
      data-search-row={`${result.kind}:${result.tmdbId}`}
      onClickCapture={(event) => {
        // The long press already opened the menu: the release is not a tap.
        if (firedRef.current) {
          firedRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onClick={() => onOpen?.(result)}
      onContextMenu={(event) => {
        if (!onMenu) {
          return;
        }
        event.preventDefault();
        openMenu();
        // A right click never ends in a click: nothing to swallow.
        firedRef.current = false;
      }}
      {...(onMenu
        ? {
            ...longPress,
            onPointerDown: (event: PointerEvent) => {
              // A new gesture: whatever the last hold left behind is not this tap's.
              firedRef.current = false;
              longPress.onPointerDown(event);
            },
          }
        : {})}
      className={cn(
        glassRowClass,
        "group card-physics press-scale flex w-full min-w-0 select-none items-center gap-3 p-2.5 text-left [-webkit-touch-callout:none]",
        "transition-[border-color,background-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:border-accent/40",
        status === "watchlist" && "border-accent/30",
        focusRing,
      )}
    >
      <SearchResultRowBody
        result={result}
        titleId={titleId}
        detail={detail}
        status={status}
        facts={facts}
        morph
      />
    </Link>
  );
};

/** The row's content; the menu's lifted copy reuses it without the link or the morph. */
export const SearchResultRowBody = ({
  result,
  titleId,
  detail,
  status = null,
  facts = null,
  morph = false,
}: Pick<SearchResultRowProps, "result" | "titleId" | "detail" | "status" | "facts"> & { morph?: boolean }) => {
  const poster = (
    <PosterImage
      name={result.name}
      posterPath={result.posterPath}
      sizes="56px"
      tmdbSize="w185"
      className="rounded-poster"
    />
  );
  const original =
    result.originalName && !sameTitle(result.originalName, result.name) ? result.originalName : null;
  const meta = [
    result.year ? String(result.year) : null,
    formatRuntime(facts?.runtimeMinutes ?? null),
    TITLE_KIND_LABEL[result.kind],
    facts?.genre ?? null,
  ].filter(Boolean);

  return (
    <>
      <span className="w-14 shrink-0 overflow-hidden rounded-poster shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition-[filter] duration-[var(--duration-hover)] group-hover:brightness-110">
        <SharedPoster titleId={searchPosterKey(result, titleId)} share={morph}>
          {poster}
        </SharedPoster>
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="line-clamp-2 font-serif text-[17px] leading-snug text-pretty break-words text-paper">
          {result.name}
        </span>
        <span className="block truncate text-[13px] text-fog">
          {meta.join(" · ")}
          {detail ? <> · {detail}</> : null}
        </span>
        {original ? <span className="block truncate text-xs italic text-mist">{original}</span> : null}
        <SearchFactsLine facts={facts} />
        {status ? <LibraryPill status={status} /> : null}
      </span>
      <svg
        viewBox="0 0 24 24"
        className="size-4 shrink-0 text-faint transition-[transform,color] duration-[var(--duration-hover)] ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:text-accent"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </>
  );
};

/**
 * Row A's data line: IMDb · laurel · platform in plain text. Nothing without
 * data (the ficha says «Aún sin calificación»; a row stays quiet). While the
 * Catalog fills, two pills hold the line's height so nothing jumps.
 */
const SearchFactsLine = ({ facts }: { facts: SearchResultFacts | null }) => {
  if (!facts) {
    return null;
  }
  if (facts.pending) {
    return (
      <span className="flex h-4 items-center gap-1.5" aria-hidden="true">
        <span className="shimmer inline-block h-3 w-12 rounded-full" />
        <span className="shimmer inline-block h-3 w-16 rounded-full" />
      </span>
    );
  }
  const bits: ReactNode[] = [];
  if (facts.imdbRating != null) {
    bits.push(<ImdbBadge key="imdb" rating={facts.imdbRating} compact />);
  }
  if (facts.awardLabel) {
    bits.push(
      <span key="award" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-star">
        <LaurelIcon />
        {facts.awardLabel}
      </span>,
    );
  }
  if (facts.platform) {
    bits.push(
      <span key="platform" className="min-w-0 truncate text-xs text-paper/75">
        {facts.platform}
      </span>,
    );
  }
  if (bits.length === 0) {
    return null;
  }
  return (
    <span className="flex h-4 min-w-0 items-center gap-1.5 overflow-hidden">
      {bits.map((bit, index) => (
        <span key={index} className={cn("inline-flex items-center gap-1.5", index === bits.length - 1 ? "min-w-0" : "shrink-0")}>
          {index > 0 ? <span className="text-xs text-faint" aria-hidden="true">·</span> : null}
          {bit}
        </span>
      ))}
    </span>
  );
};

/** «En Quiero ver» (accent) or «La viste» (success): where it already is. */
const LibraryPill = ({ status }: { status: Exclude<SearchRowStatus, null> }) => (
  <span
    className={cn(
      "mt-0.5 inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
      status === "watchlist" ? "bg-accent/15 text-accent-hover" : "bg-success-well text-success",
    )}
  >
    <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {status === "watchlist" ? (
        <path fill="currentColor" d="M7 4.5h10.5a1 1 0 0 1 1 1V20L12.25 16.5 6 20V5.5a1 1 0 0 1 1-1Z" />
      ) : (
        <path d="m5 12 5 5 9-10" />
      )}
    </svg>
    {status === "watchlist" ? "En Quiero ver" : "La viste"}
  </span>
);
