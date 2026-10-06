"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5" role="group" aria-label="Filtros rápidos">
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
