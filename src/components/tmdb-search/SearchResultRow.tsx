"use client";

import type { ReactNode } from "react";
import { SharedPoster } from "@/components/SharedPoster";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { focusRing } from "@/lib/ui";

/** Where the title already is in the user's Filmia. */
export type SearchRowStatus = "watched" | "watchlist" | null;

type SearchResultRowProps = {
  result: TmdbCatalogResult;
  /** Local title id: the poster flies to the ficha (SharedPoster) when set. */
  titleId?: string | null;
  /** Extra meta after «año · tipo» (e.g. the character in a cast filmography). */
  detail?: ReactNode;
  status?: SearchRowStatus;
  onPreview: (result: TmdbCatalogResult) => void;
};

/**
 * One Buscar result. Long titles take up to two lines; poster and chevron
 * never shrink, so the row always fits its column at any width.
 */
export const SearchResultRow = ({
  result,
  titleId,
  detail,
  status = null,
  onPreview,
}: SearchResultRowProps) => {
  const poster = (
    <PosterImage
      name={result.name}
      posterPath={result.posterPath}
      sizes="48px"
      className="rounded-lg"
    />
  );

  return (
    <button
      type="button"
      onClick={() => onPreview(result)}
      className={cn(
        "group card-physics press-scale flex w-full min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5 text-left hover:border-accent/40",
        focusRing,
      )}
    >
      <span className="w-12 shrink-0 overflow-hidden rounded-lg transition-[filter] duration-[var(--duration-hover)] group-hover:brightness-110">
        {titleId ? <SharedPoster titleId={titleId}>{poster}</SharedPoster> : poster}
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="line-clamp-2 font-medium leading-snug text-pretty break-words text-paper">
          {result.name}
        </span>
        <span className="block truncate text-sm text-fog">
          {result.year ? `${result.year} · ` : ""}
          {TITLE_KIND_LABEL[result.kind]}
          {detail ? <> · {detail}</> : null}
        </span>
      </span>
      {status ? <LibraryBadge status={status} /> : null}
      <span className="shrink-0 text-mist" aria-hidden="true">
        ›
      </span>
    </button>
  );
};

/** Small glass disc: bookmark (Quiero ver) or check (Vista). */
const LibraryBadge = ({ status }: { status: Exclude<SearchRowStatus, null> }) => (
  <span
    className={cn(
      "flex size-7 shrink-0 items-center justify-center rounded-full ring-1",
      status === "watchlist"
        ? "bg-accent/15 text-accent ring-accent/30"
        : "bg-white/8 text-paper/80 ring-white/12",
    )}
  >
    <span className="sr-only">{status === "watchlist" ? "En Quiero ver" : "Vista"}</span>
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {status === "watchlist" ? (
        <path fill="currentColor" d="M7 4.5h10.5a1 1 0 0 1 1 1V20L12.25 16.5 6 20V5.5a1 1 0 0 1 1-1Z" />
      ) : (
        <path d="m6.5 12.5 3.5 3.5 7.5-8" />
      )}
    </svg>
  </span>
);
