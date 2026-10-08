"use client";

import type { ReactNode } from "react";
import { SharedPoster } from "@/components/SharedPoster";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { focusRing } from "@/lib/ui";

type SearchResultRowProps = {
  result: TmdbCatalogResult;
  /** Local title id: the poster flies to the ficha (SharedPoster) when set. */
  titleId?: string | null;
  /** Extra meta after «año · tipo» (e.g. the character in a cast filmography). */
  detail?: ReactNode;
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
      <span className="shrink-0 text-mist" aria-hidden="true">
        ›
      </span>
    </button>
  );
};
