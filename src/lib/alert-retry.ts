import { showToast } from "@/lib/toast";
import {
  retryAfterRevert,
  showActionError,
  showMaybeNetworkError,
  TOAST_COPY,
} from "@/lib/toast-alerts";

/** A retried save that lands: drop the inline error, then confirm. A throw skips the confirm. */
export const completeRetriedSave = async (
  save: () => Promise<unknown>,
  confirm: () => void,
) => {
  await save();
  confirm();
};

/**
 * Deshacer of «vista» in Quiero ver and Hoy.
 * `undoMarkWatched` is idempotent: it clears `watchedAt` and puts the film back
 * in Quiero ver with `onConflictDoNothing`. The first failure and a failed retry
 * both end in `revert`. A retry that lands confirms.
 */
export const startWatchedUndo = ({
  apply,
  revert,
  undo,
  poster,
  description,
}: {
  apply: () => void;
  revert: () => void;
  undo: () => Promise<unknown>;
  poster?: string;
  description?: string;
}) => {
  const confirm = () =>
    showToast({ title: TOAST_COPY.addedWatchlist, description, poster });
  apply();
  void Promise.resolve()
    .then(() => undo())
    .catch(() => {
      revert();
      showActionError({
        title: TOAST_COPY.couldNotUndo,
        poster,
        retry: () =>
          retryAfterRevert(apply, revert, async () => {
            await undo();
            confirm();
          }),
      });
    });
};

/**
 * «Ahora no» and «fijar esta noche» insert a pick event.
 * A second call is a different event, so there is no Reintentar.
 * Their Deshacer deletes the latest event and is also not retried, from its own toast.
 */
export const reportPickFailure = (poster?: string) => {
  showActionError({ title: TOAST_COPY.couldNotSave, poster });
};

/**
 * `toggleInvite` sets `disabledAt` to a value. Repeating it leaves the link in
 * that same state. Reintentar only when the failure is a real network error.
 * The same gate covers the other member writes in that panel (set a role, delete a member).
 */
export const reportMemberChangeFailure = (
  error: unknown,
  retry: () => Promise<unknown>,
) => {
  showMaybeNetworkError(error, {
    title: TOAST_COPY.couldNotSave,
    description: error instanceof Error ? error.message : undefined,
    retry,
  });
};

/**
 * `leaveList` checks access before it deletes the row. Once the leave has
 * landed, the next call throws because the person is no longer a member.
 * Not idempotent: no Reintentar.
 */
export const reportLeaveFailure = () => {
  showActionError({ title: TOAST_COPY.couldNotLeave });
};

/** «Ya no estaba activa.» stays info. There is nothing to retry. */
export const showAlreadyInactive = () => {
  showToast({ title: TOAST_COPY.alreadyInactive, variant: "info" });
};
