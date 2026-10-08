"use client";

import type { ReactNode } from "react";
import { SharedPoster } from "@/components/SharedPoster";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL } from "@/lib/labels";
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
  onPreview: (result: TmdbCatalogResult) => void;
};

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * One Buscar result, «Fichas» direction: the glass row of La cartelera, serif title
 * (up to two lines), «año · tipo», the original title when it differs, and where it
 * already lives in your Filmia. Poster and chevron never shrink, so it fits any width.
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
      sizes="56px"
      className="rounded-poster"
    />
  );
  const original =
    result.originalName && !sameTitle(result.originalName, result.name) ? result.originalName : null;

  return (
    <button
      type="button"
      onClick={() => onPreview(result)}
      className={cn(
        glassRowClass,
        "group card-physics press-scale flex w-full min-w-0 items-center gap-3 p-2.5 text-left",
        "transition-[border-color,background-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:border-accent/40",
        status === "watchlist" && "border-accent/30",
        focusRing,
      )}
    >
      <span className="w-14 shrink-0 overflow-hidden rounded-poster shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition-[filter] duration-[var(--duration-hover)] group-hover:brightness-110">
        {titleId ? <SharedPoster titleId={titleId}>{poster}</SharedPoster> : poster}
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="line-clamp-2 font-serif text-[17px] leading-snug text-pretty break-words text-paper">
          {result.name}
        </span>
        <span className="block truncate text-[13px] text-fog">
          {result.year ? `${result.year} · ` : ""}
          {TITLE_KIND_LABEL[result.kind]}
          {detail ? <> · {detail}</> : null}
        </span>
        {original ? <span className="block truncate text-xs italic text-mist">{original}</span> : null}
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
    </button>
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
