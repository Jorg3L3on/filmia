"use client";

import { useState, useTransition } from "react";
import { removeTitleFromList } from "@/app/actions/lists";
import { ListCardMenu } from "@/components/coverflow/ListCardMenu";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { showToast } from "@/lib/toast";

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
    onHide(title.id);
    showToast({ title: "Fuera de la lista", description: title.name });
    startTransition(async () => {
      try {
        await removeTitleFromList(listId, title.id);
      } catch {
        onRestore(title.id);
        showToast({ title: "No se pudo quitar", variant: "error" });
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
