"use client";

import { useMemo, useState } from "react";
import { moveListItem } from "@/app/actions/lists";
import { removeFromWatchlist } from "@/app/actions/watchlist";
import { WatchlistCard } from "@/components/WatchlistCard";
import {
  WINDOW_VIRTUALIZE_AFTER,
  WindowVirtualList,
} from "@/components/WindowVirtualList";
import type { ListItem, Platform } from "@/db";
import { staggerStyle } from "@/lib/motion";
import type { TitleWithTags } from "@/lib/queries";
import {
  sameOrderedIds,
  swapAdjacentIds,
  useStickyOptimistic,
} from "@/lib/use-optimistic-action";

/** Queue row (~poster 56 + py-2); slightly above measured height for safer pads. */
const WATCHLIST_QUEUE_ESTIMATE = 76;
/** Virtualize a bit earlier than the shared grid threshold — queue rows are dense. */
const WATCHLIST_VIRTUALIZE_AFTER = Math.min(WINDOW_VIRTUALIZE_AFTER, 16);

type WatchlistItem = ListItem & {
  title: TitleWithTags;
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
  const serverIds = useMemo(() => items.map((item) => item.titleId), [items]);
  const byId = useMemo(
    () => new Map(items.map((item) => [item.titleId, item])),
    [items],
  );
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
  const { value: order, error, isPending, run } = useStickyOptimistic(
    serverIds,
    sameOrderedIds,
  );

  const visible = order
    .filter((titleId) => !hiddenIds.has(titleId))
    .flatMap((titleId) => {
      const item = byId.get(titleId);
      return item ? [item] : [];
    });
  const [hero, ...queue] = visible;
  const virtualize = queue.length >= WATCHLIST_VIRTUALIZE_AFTER;

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
    run(
      order.filter((id) => id !== titleId),
      async () => {
        try {
          await removeFromWatchlist(titleId);
        } catch (caught) {
          restore(titleId);
          throw caught;
        }
      },
    );
  };

  const handleMove = (titleId: string, direction: "up" | "down") => {
    const visibleIds = visible.map((item) => item.titleId);
    const nextVisible = swapAdjacentIds(visibleIds, titleId, direction);
    const hiddenInOrder = order.filter((id) => hiddenIds.has(id));
    const index = visibleIds.indexOf(titleId);
    const neighbor = visibleIds[direction === "up" ? index - 1 : index + 1];
    run([...nextVisible, ...hiddenInOrder], () =>
      moveListItem(listId, titleId, direction, neighbor),
    );
  };

  if (visible.length === 0) {
    return (
      <p
        className="rounded-2xl border border-line bg-surface/40 px-4 py-8 text-center text-sm text-fog"
        role="status"
      >
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
          canMoveUp={false}
          canMoveDown={queue.length > 0}
          pendingOrder={isPending}
          removeAction={() => handleRemove(hero.titleId)}
          onMove={(direction) => handleMove(hero.titleId, direction)}
          onMarkedSeen={() => hide(hero.titleId)}
          onMarkSeenError={() => restore(hero.titleId)}
          preferredPlatforms={preferredPlatforms}
        />
      ) : null}

      {queue.length > 0 ? (
        virtualize ? (
          <WindowVirtualList
            items={queue}
            estimateHeight={WATCHLIST_QUEUE_ESTIMATE}
            overscan={10}
            className="divide-y divide-line"
            itemKey={(item) => item.titleId}
            renderItem={(item, index) => (
              <li key={item.titleId}>
                <WatchlistCard
                  item={item}
                  variant="queue"
                  position={index + 2}
                  canMoveUp
                  canMoveDown={index < queue.length - 1}
                  pendingOrder={isPending}
                  removeAction={() => handleRemove(item.titleId)}
                  onMove={(direction) => handleMove(item.titleId, direction)}
                  onMarkedSeen={() => hide(item.titleId)}
                  onMarkSeenError={() => restore(item.titleId)}
                  preferredPlatforms={preferredPlatforms}
                />
              </li>
            )}
          />
        ) : (
          <ul className="divide-y divide-line">
            {queue.map((item, index) => (
              <li
                key={item.titleId}
                className="stagger-in"
                style={staggerStyle(index)}
              >
                <WatchlistCard
                  item={item}
                  variant="queue"
                  position={index + 2}
                  canMoveUp
                  canMoveDown={index < queue.length - 1}
                  pendingOrder={isPending}
                  removeAction={() => handleRemove(item.titleId)}
                  onMove={(direction) => handleMove(item.titleId, direction)}
                  onMarkedSeen={() => hide(item.titleId)}
                  onMarkSeenError={() => restore(item.titleId)}
                  preferredPlatforms={preferredPlatforms}
                />
              </li>
            ))}
          </ul>
        )
      ) : null}

      {error ? (
        <div
          role="alert"
          className="space-y-2 rounded-2xl border border-danger-line bg-danger-well px-4 py-3"
        >
          <p className="text-sm text-danger">{error}</p>
          <p className="text-xs text-fog">
            El orden o la baja no se guardó. Reintenta con los controles de la
            fila.
          </p>
        </div>
      ) : null}
    </div>
  );
};
