"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CatalogSortSheet } from "@/components/catalog-filters/CatalogSortSheet";
import { catalogBarChipClass } from "@/components/catalog-filters/filter-ui";
import { ChevronIcon, ClockIcon, LaurelIcon, MoonIcon, TvIcon } from "@/components/watchlist/icons";
import { WatchlistGenreSheet } from "@/components/watchlist/WatchlistGenreSheet";
import { catalogHref, type CatalogQuery } from "@/lib/catalog-href";
import { cn } from "@/lib/cn";
import { isNight } from "@/lib/tonight/time";
import type { NightEnds } from "@/lib/tonight/types";
import { useMountedNow } from "@/lib/use-mounted-now";
import {
  WATCHLIST_SORT_OPTIONS,
  type WatchlistGenreCount,
  type WatchlistSort,
} from "@/lib/watchlist-filters";

type WatchlistFilterRailProps = {
  pathname: string;
  /** Everything currently applied, so each chip can toggle itself and keep the rest. */
  query: CatalogQuery;
  sort: WatchlistSort | null;
  genres: WatchlistGenreCount[];
  nightEnds: NightEnds;
};

/** Esta noche (at night) · Mis plataformas · Cortas · Premiadas · Género, plus the sort sheet. */
export const WatchlistFilterRail = ({ pathname, query, sort, genres, nightEnds }: WatchlistFilterRailProps) => {
  const router = useRouter();
  const now = useMountedNow();
  // By day «Esta noche» filters nothing (everything fits): hide it unless it is already on.
  const showTonight = Boolean(query.tonight) || (now !== null && isNight(now, nightEnds));
  const [genreOpen, setGenreOpen] = useState(false);
  const selectedGenres = query.genres ?? [];
  const genreLabel =
    selectedGenres.length === 0
      ? "Género"
      : selectedGenres.length === 1
        ? (genres.find((genre) => genre.id === selectedGenres[0])?.name ?? "Género")
        : `${selectedGenres.length} géneros`;

  const hrefFor = (patch: Partial<CatalogQuery>) => catalogHref(pathname, { ...query, ...patch });
  const railRef = useRef<HTMLDivElement>(null);

  // One scrollable row on the phone (FIL-I21-7): keep the active chip in view on arrival.
  const activeKey = `${query.tonight ? "t" : ""}${query.minePlatforms ? "m" : ""}${query.short ? "s" : ""}${query.awarded ? "a" : ""}${selectedGenres.length > 0 ? "g" : ""}`;
  useEffect(() => {
    const rail = railRef.current;
    const chip = rail?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!rail || !chip) {
      return;
    }
    const railBox = rail.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    // 28 px = the fade at the rail's end (.filter-rail-fade).
    const overflowRight = chipBox.right + 28 - railBox.right;
    const overflowLeft = railBox.left - chipBox.left;
    if (overflowRight > 0) {
      rail.scrollLeft += overflowRight;
    } else if (overflowLeft > 0) {
      rail.scrollLeft -= overflowLeft;
    }
  }, [activeKey]);

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div ref={railRef} className="scrollbar-none filter-rail-fade flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5 max-sm:py-0" role="group" aria-label="Filtros rápidos">
        <CatalogSortSheet
          options={WATCHLIST_SORT_OPTIONS}
          current={sort}
          title="Ordenar"
          buttonLabel={WATCHLIST_SORT_OPTIONS.find((option) => option.id === sort)?.label ?? "Mi orden"}
          onSelect={(next) => router.push(hrefFor({ sort: next }))}
        />
        {showTonight ? (
          <Link
            href={hrefFor({ tonight: !query.tonight })}
            scroll={false}
            aria-pressed={Boolean(query.tonight)}
            className={cn(catalogBarChipClass(Boolean(query.tonight)), "gap-1.5")}
          >
            <MoonIcon size={14} />
            Esta noche
          </Link>
        ) : null}
        <Link
          href={hrefFor({ minePlatforms: !query.minePlatforms, platforms: [] })}
          scroll={false}
          aria-pressed={Boolean(query.minePlatforms)}
          className={cn(catalogBarChipClass(Boolean(query.minePlatforms)), "gap-1.5")}
        >
          <TvIcon size={14} />
          Mis plataformas
        </Link>
        <Link
          href={hrefFor({ short: !query.short })}
          scroll={false}
          aria-pressed={Boolean(query.short)}
          className={cn(catalogBarChipClass(Boolean(query.short)), "gap-1.5")}
        >
          <ClockIcon size={14} />
          Cortas
        </Link>
        <Link
          href={hrefFor({ awarded: !query.awarded })}
          scroll={false}
          aria-pressed={Boolean(query.awarded)}
          className={cn(catalogBarChipClass(Boolean(query.awarded)), "gap-1.5")}
        >
          <LaurelIcon size={14} />
          Premiadas
        </Link>
        <button
          type="button"
          onClick={() => setGenreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={genreOpen}
          className={cn(catalogBarChipClass(selectedGenres.length > 0), "gap-1")}
        >
          {genreLabel}
          <ChevronIcon size={13} />
        </button>
      </div>
      <WatchlistGenreSheet
        open={genreOpen}
        genres={genres}
        selected={selectedGenres}
        onClose={() => setGenreOpen(false)}
        onApply={(ids) => {
          setGenreOpen(false);
          router.push(hrefFor({ genres: ids }));
        }}
      />
    </div>
  );
};
