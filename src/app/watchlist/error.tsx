"use client";

import { useEffect } from "react";
import { Button } from "@/components/Button";
import { WatchlistChipRow } from "@/components/watchlist/WatchlistChipRow";
import { WatchlistOrderPill } from "@/components/watchlist/WatchlistOrderPill";
import { WatchlistScopeBar } from "@/components/watchlist/WatchlistScopeBar";
import { WatchlistTopBar } from "@/components/watchlist/WatchlistTopBar";
import { EMPTY_WATCHLIST_QUERY } from "@/lib/watchlist-query";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const noop = () => {};
const NO_NAMES = { genres: new Map<number, string>(), people: new Map<number, string>() };

/**
 * Read error (FIL-I34-5): the header keeps its shape with «—» and dimmed controls that do
 * nothing, and one soft-red note with «Reintentar». It never blames the person.
 */
export default function WatchlistError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4 max-sm:-mt-6" aria-labelledby="qv-error-title">
      <div className="pointer-events-none space-y-2.5 opacity-60" aria-hidden="true" inert>
        <WatchlistTopBar shown={0} total={0} narrowed={false} filterCount={0} random={false} disabled onSurprise={noop} onFilters={noop} />
        <WatchlistScopeBar scope="all" counts={{ all: 0, mine: 0 }} userPlatforms={[]} disabled onChange={noop} />
        <WatchlistChipRow
          query={EMPTY_WATCHLIST_QUERY}
          names={NO_NAMES}
          orderPill={<WatchlistOrderPill query={EMPTY_WATCHLIST_QUERY} disabled onOpen={noop} onFlip={noop} />}
          disabled
          onToggleShort={noop}
          onOpenGenres={noop}
          onRemove={noop}
          onMore={noop}
        />
      </div>
      <div role="alert" className="flex items-center gap-3 rounded-2xl border border-danger-line bg-danger-well px-4 py-3">
        <span className="text-lg font-semibold text-danger" aria-hidden="true">
          !
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-paper">
          <span id="qv-error-title" className="block font-semibold">
            No pudimos cargar tu lista.
          </span>
          <span className="text-fog">Tus títulos están a salvo.</span>
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={reset} className="relative shrink-0 before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']">
          Reintentar
        </Button>
      </div>
      <div className="space-y-2.5 opacity-40" aria-hidden="true">
        {[0, 1].map((index) => (
          <div key={index} className="h-[104px] rounded-2xl border border-line/60 bg-surface/30" />
        ))}
      </div>
    </div>
  );
}
