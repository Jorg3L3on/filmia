import { showToast } from "@/lib/toast";

/** Copy and timing for «Quitar del diario». The light line stays with FIL-I27. */
export const DIARY_REMOVED_TITLE = "Quitada de tu diario";
export const DIARY_UNDO_LABEL = "Deshacer";
export const DIARY_UNDO_MS = 7000;
export const DIARY_UNDO_FAILED = "No se pudo deshacer";

/**
 * Runs `restore` only after the clear that is already in flight settles.
 * The toast is shown before that clear finishes; Deshacer must not land first
 * or the clear would wipe the restored date. A failed clear does not restore
 * and does not reject: the entry never left.
 */
export const chainDiaryUndo = (clear: Promise<unknown>, restore: () => Promise<unknown>) =>
  clear.then(
    () => restore(),
    () => undefined,
  );

export const showDiaryRemovedToast = ({
  clear,
  restore,
  onUndo,
  onUndoFailed,
}: {
  clear: Promise<unknown>;
  restore: () => Promise<unknown>;
  /** Optimistic UI when Deshacer is pressed, before the clear has finished. */
  onUndo?: () => void;
  /** Restore itself failed. A failed clear is not this: the entry never left. */
  onUndoFailed?: () => void;
}) => {
  showToast({
    title: DIARY_REMOVED_TITLE,
    durationMs: DIARY_UNDO_MS,
    action: {
      label: DIARY_UNDO_LABEL,
      onClick: () => {
        onUndo?.();
        void chainDiaryUndo(clear, restore).catch(() => {
          onUndoFailed?.();
          showToast({ title: DIARY_UNDO_FAILED, variant: "error" });
        });
      },
    },
  });
};
