"use client";

import { useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { moveListItem, reorderList } from "@/app/actions/lists";
import { removeFromWatchlist } from "@/app/actions/watchlist";
import { WatchlistReorderRow } from "@/components/WatchlistCard";
import { WatchlistGrid } from "@/components/WatchlistGrid";
import { WatchlistHero } from "@/components/WatchlistHero";
import type { WatchlistItem } from "@/components/watchlist-types";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import {
  sameOrderedIds,
  swapAdjacentIds,
  useStickyOptimistic,
} from "@/lib/use-optimistic-action";
import { pillActionClass, safeAreaStickyUnderHeaderClass } from "@/lib/ui";

type WatchlistListProps = {
  items: WatchlistItem[];
  listId: string;
  preferredPlatforms?: readonly Platform[];
  /** Manual order is only meaningful on the unfiltered, unsorted queue. */
  isManualOrder?: boolean;
};

const screenReaderInstructions = {
  draggable:
    "Para mover un título, pulsa espacio o enter. Usa las flechas para cambiar su lugar y pulsa espacio o enter para soltarlo, o escape para cancelar.",
};

export const WatchlistList = ({
  items,
  listId,
  preferredPlatforms = [],
  isManualOrder = true,
}: WatchlistListProps) => {
  const serverIds = useMemo(() => items.map((item) => item.titleId), [items]);
  const byId = useMemo(
    () => new Map(items.map((item) => [item.titleId, item])),
    [items],
  );
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
  const [isEditing, setIsEditing] = useState(false);
  const { value: order, error, isPending, run } = useStickyOptimistic(
    serverIds,
    sameOrderedIds,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visible = order
    .filter((titleId) => !hiddenIds.has(titleId))
    .flatMap((titleId) => {
      const item = byId.get(titleId);
      return item ? [item] : [];
    });
  const visibleIds = visible.map((item) => item.titleId);
  const hiddenInOrder = order.filter((id) => hiddenIds.has(id));
  const [hero, ...queue] = visible;
  const nameOf = (titleId: string | number) => byId.get(String(titleId))?.title.name ?? "Título";
  const rankOf = (titleId: string | number) => visibleIds.indexOf(String(titleId)) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Moviendo ${nameOf(active.id)}, lugar ${rankOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} irá al lugar ${rankOf(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${nameOf(active.id)} quedó en el lugar ${rankOf(over.id)}.` : undefined,
    onDragCancel: ({ active }) => `Se canceló mover ${nameOf(active.id)}.`,
  };

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
    const nextVisible = swapAdjacentIds(visibleIds, titleId, direction);
    const index = visibleIds.indexOf(titleId);
    const neighbor = visibleIds[direction === "up" ? index - 1 : index + 1];
    run([...nextVisible, ...hiddenInOrder], () =>
      moveListItem(listId, titleId, direction, neighbor),
    );
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }
    const from = visibleIds.indexOf(String(active.id));
    const to = visibleIds.indexOf(String(over.id));
    if (from < 0 || to < 0) {
      return;
    }
    const nextVisible = arrayMove(visibleIds, from, to);
    run([...nextVisible, ...hiddenInOrder], () => reorderList(listId, nextVisible));
  };

  const handleToggleEditing = () => {
    setIsEditing((current) => !current);
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

  const countLabel = visible.length === 1 ? "1 título" : `${visible.length} títulos`;
  const canReorder = isManualOrder && visible.length > 1;

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          isEditing &&
            cn(
              "sticky z-30 -mx-4 border-b border-line/70 bg-canvas/90 px-4 py-2.5 backdrop-blur-md",
              safeAreaStickyUnderHeaderClass,
            ),
        )}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mist">
          {isEditing ? "Arrastra o usa las flechas" : countLabel}
        </p>
        {canReorder ? (
          <button
            type="button"
            onClick={handleToggleEditing}
            aria-pressed={isEditing}
            className={isEditing ? pillActionClass.primary : pillActionClass.neutral}
          >
            {isEditing ? <CheckIcon /> : <ReorderIcon />}
            {isEditing ? "Listo" : "Reordenar"}
          </button>
        ) : visible.length > 1 ? (
          <p className="text-xs text-mist">Quita filtros para reordenar</p>
        ) : null}
      </div>

      {isEditing && canReorder ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          accessibility={{ announcements, screenReaderInstructions }}
        >
          <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2" aria-label="Orden de Quiero ver">
              {visible.map((item, index) => (
                <WatchlistReorderRow
                  key={item.titleId}
                  item={item}
                  position={index + 1}
                  canMoveUp={index > 0}
                  canMoveDown={index < visible.length - 1}
                  pendingOrder={isPending}
                  onMove={(direction) => handleMove(item.titleId, direction)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <>
          {hero ? (
            <WatchlistHero
              key={hero.titleId}
              item={hero}
              preferredPlatforms={preferredPlatforms}
              onRemove={() => handleRemove(hero.titleId)}
              onMarkedSeen={() => hide(hero.titleId)}
              onMarkSeenError={() => restore(hero.titleId)}
            />
          ) : null}
          {queue.length > 0 ? (
            <WatchlistGrid
              items={queue}
              preferredPlatforms={preferredPlatforms}
              onMarkedSeen={hide}
              onMarkSeenError={restore}
            />
          ) : null}
        </>
      )}

      {error ? (
        <div
          role="alert"
          className="space-y-2 rounded-2xl border border-danger-line bg-danger-well px-4 py-3"
        >
          <p className="text-sm text-danger">{error}</p>
          <p className="text-xs text-fog">
            El orden o la baja no se guardó. Inténtalo de nuevo.
          </p>
        </div>
      ) : null}
    </div>
  );
};

const ReorderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
    <path d="M7 4v16M3.5 7.5 7 4l3.5 3.5M17 20V4M13.5 16.5 17 20l3.5-3.5" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
