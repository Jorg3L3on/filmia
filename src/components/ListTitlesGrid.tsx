"use client";

import { useMemo, useState } from "react";
import { moveListItem, removeTitleFromList } from "@/app/actions/lists";
import { ListItemOrderControls } from "@/components/ListItemOrderControls";
import { MarkWatchedForm } from "@/components/MarkWatchedForm";
import { PosterTile } from "@/components/PosterTile";
import type { ListItem } from "@/db";
import type { TitleWithTags } from "@/lib/queries";
import { btnLink } from "@/lib/ui";
import {
  sameOrderedIds,
  swapAdjacentIds,
  useStickyOptimistic,
} from "@/lib/use-optimistic-action";

type ListItemPayload = ListItem & {
  title: TitleWithTags;
};

type ListTitlesGridProps = {
  listId: string;
  items: ListItemPayload[];
  showOrder: boolean;
};

export const ListTitlesGrid = ({
  listId,
  items,
  showOrder,
}: ListTitlesGridProps) => {
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

  const handleRemove = (titleId: string) => {
    setHiddenIds((current) => new Set(current).add(titleId));
    run(
      order.filter((id) => id !== titleId),
      async () => {
        try {
          await removeTitleFromList(listId, titleId);
        } catch (caught) {
          setHiddenIds((current) => {
            const next = new Set(current);
            next.delete(titleId);
            return next;
          });
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

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {visible.map((item, index) => (
          <li key={item.titleId} className="space-y-2">
            <PosterTile
              titleId={item.title.id}
              href={`/titulos/${item.title.id}`}
              name={item.title.name}
              posterPath={item.title.posterPath}
              year={item.title.year}
              rating={item.title.rating}
              watchedAt={item.title.watchedAt}
              tags={item.title.tags.map((entry) => entry.tag)}
              seriesStatus={
                item.title.kind === "SERIES" ? item.title.seriesStatus : null
              }
            />
            {showOrder ? (
              <ListItemOrderControls
                canMoveUp={index > 0}
                canMoveDown={index < visible.length - 1}
                pending={isPending}
                onMove={(direction) => handleMove(item.titleId, direction)}
              />
            ) : null}
            {!item.title.watchedAt ? (
              <MarkWatchedForm
                titleId={item.title.id}
                variant="queue"
                rating={item.title.rating}
                review={item.title.review}
                collapsed
              />
            ) : null}
            <button
              type="button"
              onClick={() => handleRemove(item.titleId)}
              className={`${btnLink} w-full`}
            >
              Quitar de la lista
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
};
