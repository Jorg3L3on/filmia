"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { CatalogSortSheet } from "@/components/catalog-filters/CatalogSortSheet";
import { catalogBarChipClass } from "@/components/catalog-filters/filter-ui";
import { ChevronIcon, ClockIcon, LaurelIcon, MoonIcon, TvIcon } from "@/components/watchlist/icons";
import { WatchlistGenreSheet } from "@/components/watchlist/WatchlistGenreSheet";
import { catalogHref, type CatalogQuery } from "@/lib/catalog-href";
import { cn } from "@/lib/cn";
import { isNight } from "@/lib/tonight/time";
import type { NightEnds } from "@/lib/tonight/types";
import { focusRing } from "@/lib/ui";
import { useMountedNow } from "@/lib/use-mounted-now";
import {
  WATCHLIST_SORT_OPTIONS,
  type WatchlistGenreCount,
  type WatchlistSort,
} from "@/lib/watchlist-filters";

export type WatchlistRailCounts = {
  /** Titles of the whole list that «Cortas» would keep. */
  short: number;
  /** Titles of the whole list that «Premiadas» would keep. */
  awarded: number;
};

type WatchlistFilterRailProps = {
  pathname: string;
  /** Everything currently applied, so each chip can toggle itself and keep the rest. */
  query: CatalogQuery;
  sort: WatchlistSort | null;
  genres: WatchlistGenreCount[];
  counts: WatchlistRailCounts;
  nightEnds: NightEnds;
};

/** How far the «›» disc scrolls the rail. */
const RAIL_STEP_PX = 200;
/** The fade at the rail's end (`.filter-rail-fade`, FIL-I24-3). */
const RAIL_FADE_PX = 48;

/** Rail chip: 36 px visible, 44 px touch (`.rail-chip::before`). */
const railChipClass = (selected: boolean) => cn(catalogBarChipClass(selected), "rail-chip gap-1");

type CountChipProps = {
  href: string;
  active: boolean;
  count: number;
  icon: ReactNode;
  label: string;
};

/** Cortas / Premiadas: the count rides on the chip; at 0 the chip dims and leads nowhere. */
const CountChip = ({ href, active, count, icon, label }: CountChipProps) => {
  const empty = count === 0 && !active;
  const swallow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (empty) {
      event.preventDefault();
    }
  };
  return (
    <Link
      href={href}
      scroll={false}
      aria-pressed={active}
      aria-disabled={empty || undefined}
      aria-label={`${label}, ${count} ${count === 1 ? "título" : "títulos"}`}
      tabIndex={empty ? -1 : undefined}
      onClick={swallow}
      className={cn(railChipClass(active), empty && "rail-chip-empty")}
    >
      {icon}
      {label}
      <span className="rail-chip-count" aria-hidden="true">
        {count}
      </span>
    </Link>
  );
};

/**
 * Riel A «Un riel que se ve» (FIL-I24-3): orden · Esta noche (at night) · Mis plataformas ·
 * Cortas · Premiadas · Género on one native-scrolling row, 36 px visible / 44 touch, a 48 px
 * fade and a «›» disc while there is more to the right.
 */
export const WatchlistFilterRail = ({ pathname, query, sort, genres, counts, nightEnds }: WatchlistFilterRailProps) => {
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
  const sortLabel = WATCHLIST_SORT_OPTIONS.find((option) => option.id === sort)?.label;

  const hrefFor = (patch: Partial<CatalogQuery>) => catalogHref(pathname, { ...query, ...patch });
  const railRef = useRef<HTMLDivElement>(null);
  // More chips to the right than the rail shows: fade + disc (native scroll does the rest).
  const [overflowRight, setOverflowRight] = useState(false);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) {
      return;
    }
    const measure = () => setOverflowRight(rail.scrollWidth - rail.clientWidth - rail.scrollLeft > 4);
    rail.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    for (const child of rail.children) {
      observer.observe(child);
    }
    return () => {
      rail.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [showTonight]);

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
    const overflowRight = chipBox.right + RAIL_FADE_PX - railBox.right;
    const overflowLeft = railBox.left - chipBox.left;
    if (overflowRight > 0) {
      rail.scrollLeft += overflowRight;
    } else if (overflowLeft > 0) {
      rail.scrollLeft -= overflowLeft;
    }
  }, [activeKey]);

  return (
    <div className="relative flex min-w-0 items-center gap-1.5">
      <div
        ref={railRef}
        data-overflow={overflowRight ? "right" : undefined}
        className="scrollbar-none filter-rail-fade flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5"
        role="group"
        aria-label="Filtros rápidos"
      >
        <CatalogSortSheet
          options={WATCHLIST_SORT_OPTIONS}
          current={sort}
          title="Ordenar"
          buttonLabel={sort && sortLabel ? `Orden · ${sortLabel}` : "Mi orden"}
          chevron
          icon={false}
          buttonClassName="rail-chip"
          onSelect={(next) => router.push(hrefFor({ sort: next }))}
        />
        {showTonight ? (
          <Link
            href={hrefFor({ tonight: !query.tonight })}
            scroll={false}
            aria-pressed={Boolean(query.tonight)}
            className={railChipClass(Boolean(query.tonight))}
          >
            <MoonIcon size={14} />
            Esta noche
          </Link>
        ) : null}
        <Link
          href={hrefFor({ minePlatforms: !query.minePlatforms, platforms: [] })}
          scroll={false}
          aria-pressed={Boolean(query.minePlatforms)}
          className={railChipClass(Boolean(query.minePlatforms))}
        >
          <TvIcon size={14} />
          Mis plataformas
        </Link>
        <CountChip
          href={hrefFor({ short: !query.short })}
          active={Boolean(query.short)}
          count={counts.short}
          icon={<ClockIcon size={14} />}
          label="Cortas"
        />
        <CountChip
          href={hrefFor({ awarded: !query.awarded })}
          active={Boolean(query.awarded)}
          count={counts.awarded}
          icon={<LaurelIcon size={14} />}
          label="Premiadas"
        />
        <button
          type="button"
          onClick={() => setGenreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={genreOpen}
          className={cn(catalogBarChipClass(selectedGenres.length > 0), "rail-chip gap-1")}
        >
          {genreLabel}
          <ChevronIcon size={13} />
        </button>
      </div>
      {overflowRight ? (
        <button
          type="button"
          aria-label="Ver más filtros"
          onClick={() => railRef.current?.scrollBy({ left: RAIL_STEP_PX, behavior: "smooth" })}
          className={cn("rail-more press-scale", focusRing)}
        >
          <ChevronIcon size={12} />
        </button>
      ) : null}
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
