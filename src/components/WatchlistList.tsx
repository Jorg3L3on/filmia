"use client";

import { useState, useTransition } from "react";
import { removeFromWatchlist } from "@/app/actions/watchlist";
import { WatchlistCard } from "@/components/WatchlistCard";
import type { ListItem, Platform } from "@/db";
import type { TitleWithRelations } from "@/lib/queries";

type WatchlistItem = ListItem & {
  title: TitleWithRelations;
};

type WatchlistListProps = {
  items: WatchlistItem[];
  listId: string;
  preferredPlatforms?: readonly Platform[];
};

export const WatchlistList = ({
  items,
  listId,
  preferredPlatforms = [],
}: WatchlistListProps) => {
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
  const [, startTransition] = useTransition();
  const visible = items.filter((item) => !hiddenIds.has(item.titleId));
  const [hero, ...queue] = visible;

  const hide = (titleId: string) => {
    setHiddenIds((current) => new Set(current).add(titleId));
  };

  const restore = (titleId: string) => {
    setHiddenIds((current) => {
      const next = new Set(current);
      next.delete(titleId);
      return next;
    });
  };

  const handleRemove = (titleId: string) => {
    hide(titleId);
    startTransition(async () => {
      try {
        await removeFromWatchlist(titleId);
      } catch {
        restore(titleId);
      }
    });
  };

  if (visible.length === 0) {
    return (
      <p className="text-sm text-fog" role="status">
        Nada en Quiero ver por ahora.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {hero ? (
        <WatchlistCard
          item={hero}
          variant="hero"
          position={1}
          listId={listId}
          canMoveUp={false}
          canMoveDown={queue.length > 0}
          swapDownTitleId={queue[0]?.titleId}
          removeAction={() => handleRemove(hero.titleId)}
          onMarkedSeen={() => hide(hero.titleId)}
          onMarkSeenError={() => restore(hero.titleId)}
          preferredPlatforms={preferredPlatforms}
        />
      ) : null}

      {queue.length > 0 ? (
        <ul className="divide-y divide-line">
          {queue.map((item, index) => {
            const visibleIndex = index + 1;
            return (
              <li key={item.titleId}>
                <WatchlistCard
                  item={item}
                  variant="queue"
                  position={index + 2}
                  listId={listId}
                  canMoveUp
                  canMoveDown={index < queue.length - 1}
                  swapUpTitleId={visible[visibleIndex - 1]?.titleId}
                  swapDownTitleId={visible[visibleIndex + 1]?.titleId}
                  removeAction={() => handleRemove(item.titleId)}
                  onMarkedSeen={() => hide(item.titleId)}
                  onMarkSeenError={() => restore(item.titleId)}
                  preferredPlatforms={preferredPlatforms}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
