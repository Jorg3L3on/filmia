"use client";

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
import { WatchlistReorderRow } from "@/components/WatchlistCard";
import type { FichaView } from "@/components/watchlist/types";

type WatchlistReorderListProps = {
  items: FichaView[];
  isPending: boolean;
  onMove: (titleId: string, direction: "up" | "down") => void;
  /** The full visible order after a drag; the caller calls `reorderList`. */
  onReorder: (orderedIds: string[]) => void;
};

const screenReaderInstructions = {
  draggable:
    "Para mover un título, pulsa espacio o enter. Usa las flechas para cambiar su lugar y pulsa espacio o enter para soltarlo, o escape para cancelar.",
};

/** Edit mode: drag handles + arrows over the whole visible queue (dnd-kit). */
export const WatchlistReorderList = ({ items, isPending, onMove, onReorder }: WatchlistReorderListProps) => {
  const ids = items.map((item) => item.id);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const nameOf = (titleId: string | number) => items.find((item) => item.id === String(titleId))?.name ?? "Título";
  const rankOf = (titleId: string | number) => ids.indexOf(String(titleId)) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Moviendo ${nameOf(active.id)}, lugar ${rankOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} irá al lugar ${rankOf(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${nameOf(active.id)} quedó en el lugar ${rankOf(over.id)}.` : undefined,
    onDragCancel: ({ active }) => `Se canceló mover ${nameOf(active.id)}.`,
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) {
      return;
    }
    onReorder(arrayMove(ids, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements, screenReaderInstructions }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2" aria-label="Orden de Quiero ver">
          {items.map((item, index) => (
            <WatchlistReorderRow
              key={item.id}
              ficha={item}
              position={index + 1}
              canMoveUp={index > 0}
              canMoveDown={index < items.length - 1}
              pendingOrder={isPending}
              onMove={(direction) => onMove(item.id, direction)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
};
