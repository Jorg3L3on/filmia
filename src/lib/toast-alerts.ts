import { showToast, type ToastPayload } from "@/lib/toast";
import { tmdbPosterUrl } from "@/lib/tmdb";

/**
 * Provisional copy for FIL-I28 («{Sustantivo} {participio}»).
 * Jorge still has to approve it. «Ahora no» and «No te la volveremos a sugerir» stay as they are.
 */
export const TOAST_COPY = {
  addedDiary: "Añadida a tu diario",
  addedWatchlist: "Añadida a Quiero ver",
  removedWatchlist: "Quitada de Quiero ver",
  addedList: "Añadida a la lista",
  removedList: "Quitada de la lista",
  addedYourList: "Añadida a tu lista",
  listsUpdated: "Listas actualizadas",
  markedSeen: "Marcada como vista",
  markedUnseen: "Marcada como no vista",
  diaryUpdated: "Diario actualizado",
  noteSaved: "Nota guardada",
  noteRemoved: "Nota quitada",
  reservedTonight: "Reservada para esta noche",
  choiceConfirmed: "Elección confirmada",
  movedFirst: "Movida al principio",
  seriesStatusUpdated: "Estado de serie actualizado",
  seriesStatusCleared: "Estado de serie quitado",
  fichaUpdated: "Ficha actualizada",
  fichaConfirmed: "Ficha confirmada",
  affinityNoted: "Afinidad anotada",
  distanceNoted: "Distancia anotada",
  topSaved: "Top guardado",
  listDeleted: "Lista eliminada",
  requestApproved: "Solicitud aprobada",
  requestRejected: "Solicitud rechazada",
  linkCopied: "Enlace copiado",
  linkRevoked: "Enlace revocado",
  linkOff: "Enlace apagado",
  linkOn: "Enlace activado",
  connectionClosed: "Conexión cerrada",
  tokenRevoked: "Token revocado",
  leftList: "Salida confirmada",
  notTonight: "Ahora no",
  neverSuggest: "No te la volveremos a sugerir",
  couldNotSave: "No se pudo guardar",
  couldNotRemove: "No se pudo quitar",
  couldNotAdd: "No se pudo agregar",
  couldNotReserve: "No se pudo reservar",
  couldNotLeave: "No se pudo salir",
  couldNotUndo: "No se pudo deshacer",
  couldNotCopyLink: "No se pudo copiar el enlace",
  couldNotCreateLink: "No se pudo crear el enlace",
  stillRemoving: "No se puede quitar todavía",
  stillRemovingDetail: "Se está guardando la fecha vista.",
  alreadyInactive: "Ya no estaba activa.",
  retry: "Reintentar",
  retryHint: "Puedes volver a intentarlo.",
  retryFailed: "Sigue sin poder hacerse.",
} as const;

export const addedToLists = (count: number) =>
  count === 1 ? TOAST_COPY.addedYourList : `Añadidas a ${count} listas`;

/** The film or series is what was added: feminine, even when the list name is not. */
export const addedToNamedList = (name: string) => `Añadida a ${name}`;

export const removedFromNamedList = (name: string) => `Quitada de ${name}`;

/** Poster for a film or series toast. No path → the host draws the variant icon. */
export const toastPoster = (posterPath: string | null | undefined) =>
  tmdbPosterUrl(posterPath, "w185") ?? undefined;

/**
 * A fetch that never reached our action. `{ ok: false, error: string }` is not this:
 * that string mixes validation, permission and server faults, and we do not invent a split.
 * `TypeError` is what `fetch` raises (`Failed to fetch`, `Load failed`).
 */
export const isNetworkFailure = (error: unknown) => {
  if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "NetworkError") {
    return true;
  }
  return error instanceof TypeError;
};

type ActionErrorOptions = {
  title: string;
  /** Shown when there is no Reintentar. A retryable toast uses the recovery line instead. */
  description?: string;
  poster?: string;
  /**
   * Run the operation once more. Re-apply optimistic state inside this function.
   * Throw on failure: the next toast has no Reintentar.
   */
  retry?: () => Promise<unknown> | unknown;
};

/** Error toast. With `retry`, the button runs that function once and then stops. */
export const showActionError = ({ title, description, poster, retry }: ActionErrorOptions) => {
  showToast({
    title,
    description: retry ? TOAST_COPY.retryHint : description,
    variant: "error",
    poster,
    action: retry
      ? {
          label: TOAST_COPY.retry,
          onClick: () => {
            void Promise.resolve()
              .then(() => retry())
              .catch((caught: unknown) => {
                const detail = isNetworkFailure(caught)
                  ? TOAST_COPY.retryFailed
                  : caught instanceof Error && caught.message
                    ? caught.message
                    : description;
                showToast({
                  title,
                  description: detail || TOAST_COPY.retryFailed,
                  variant: "error",
                  poster,
                });
              });
          },
        }
      : undefined,
  });
};

/**
 * Conditional sites. Reintentar only for `isNetworkFailure`. Anything else, including a
 * permission `Error` or `{ ok: false, error }`, is a plain error.
 */
export const showMaybeNetworkError = (
  error: unknown,
  options: Omit<ActionErrorOptions, "retry"> & { retry: () => Promise<unknown> | unknown },
) => {
  if (!isNetworkFailure(error)) {
    const description =
      options.description ?? (error instanceof Error && error.message ? error.message : undefined);
    showActionError({ title: options.title, description, poster: options.poster });
    return;
  }
  showActionError(options);
};

/**
 * Keep a caller's poster. Fill one in only when the caller did not bring its own,
 * so `{ ...custom, poster }` cannot replace it with `undefined`.
 */
export const toastWithPoster = (toast: ToastPayload, poster: string | undefined): ToastPayload => {
  if (toast.poster || !poster) {
    return toast;
  }
  return { ...toast, poster };
};

/** Re-apply the optimistic state, run once, and revert if that run throws. */
export const retryAfterRevert = async (
  reapply: () => void,
  revert: () => void,
  run: () => Promise<unknown>,
) => {
  reapply();
  try {
    await run();
  } catch (caught) {
    revert();
    throw caught;
  }
};
