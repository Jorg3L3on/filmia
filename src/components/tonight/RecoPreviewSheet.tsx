"use client";

import { SearchPreviewSheet } from "@/components/SearchPreviewSheet";
import type { RecoActions } from "@/components/tonight/useRecoActions";
import { recoResultOf } from "@/lib/tonight/reco-card";

/**
 * The Buscar preview sheet for a recommended film: Quiero ver, Vi esto, Ver esta noche, Ficha.
 * Nothing is created until the user acts (opening the ficha creates the entry on the way).
 */
export const RecoPreviewSheet = ({ actions }: { actions: RecoActions }) => {
  const card = actions.preview;
  const result = card ? recoResultOf(card) : null;
  if (!card || !result) {
    return null;
  }
  const local = actions.local[card.id] ?? null;
  const pending = actions.pending?.id === card.id;
  const pinned = actions.pinnedId === card.id;

  return (
    <SearchPreviewSheet
      open
      result={result}
      local={local}
      pending={pending}
      pendingAction={pending ? (actions.pending?.action ?? null) : null}
      onClose={actions.closePreview}
      onAdd={(destination) => actions.add(card, destination)}
      onOpen={() => actions.openFicha(card)}
      error={actions.error}
      tonight={
        local?.watched
          ? null
          : {
              done: pinned,
              celebrate: actions.justPinnedId === card.id,
              error: actions.tonightError,
              onPin: () => actions.pin(card),
            }
      }
    />
  );
};
