"use client";

import { useState, useTransition } from "react";
import { removeTitleFromList } from "@/app/actions/lists";
import { ListCardMenu } from "@/components/coverflow/ListCardMenu";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { showToast } from "@/lib/toast";
import { retryAfterRevert, showActionError, TOAST_COPY, toastPoster } from "@/lib/toast-alerts";

/**
 * List deck card menu (hold the hero or tap «⋯»): Ver ficha · Mover · Quitar de la lista.
 * Quitar is optimistic — hides the card, toasts, and restores it if the server call fails.
 * Disabled (no handler, no sheet) without a `listId` — automatic lists can't be edited.
 */
export const useListCardMenu = ({
  listId,
  enabled,
  onHide,
  onRestore,
}: {
  listId?: string;
  enabled: boolean;
  onHide: (titleId: string) => void;
  onRestore: (titleId: string) => void;
}) => {
  const [menuTitle, setMenuTitle] = useState<CoverflowTitle | null>(null);
  const [, startTransition] = useTransition();
  const active = enabled && Boolean(listId);

  const handleRemove = (title: CoverflowTitle) => {
    if (!listId) {
      return;
    }
    setMenuTitle(null);
    const poster = toastPoster(title.posterPath);
    const removed = () => showToast({ title: TOAST_COPY.removedList, description: title.name, poster });
    onHide(title.id);
    removed();
    startTransition(async () => {
      try {
        await removeTitleFromList(listId, title.id);
      } catch {
        onRestore(title.id);
        showActionError({
          title: TOAST_COPY.couldNotRemove,
          poster,
          retry: async () => {
            await retryAfterRevert(
              () => onHide(title.id),
              () => onRestore(title.id),
              () => removeTitleFromList(listId, title.id),
            );
            removed();
          },
        });
      }
    });
  };

  return {
    openMenu: active ? setMenuTitle : undefined,
    menu: active ? (
      <ListCardMenu title={menuTitle} onClose={() => setMenuTitle(null)} onRemove={handleRemove} />
    ) : null,
  };
};
