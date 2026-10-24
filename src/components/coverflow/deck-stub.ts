/**
 * The tear-off stub is on every full card that is not watched yet.
 * Hoy is not required: the same card is the deck of a list and of Quiero ver,
 * and there `useTonight()` is null.
 */
export const deckShowsStub = (compact: boolean, watched: boolean | undefined) =>
  !compact && !watched;

/**
 * The sheet closes before the save finishes. Hoy toasts that failure through
 * `onWatchError`. Without that handler the sheet's own toast is the only notice.
 */
export const stubToastsItsOwnError = (
  sala: { onWatchError?: unknown } | null | undefined,
) => !sala?.onWatchError;
