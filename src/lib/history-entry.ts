/**
 * Small per-history-entry memory (Back restores it; a fresh visit from the dock
 * starts clean). Lives next to Next's own keys in `history.state`; a state that
 * keeps Next's internals is passed through by its replaceState patch untouched.
 */

const KEY = "filmia";

type EntryState = Record<string, unknown>;

const entryOf = (): EntryState => {
  if (typeof window === "undefined") {
    return {};
  }
  const value = (window.history.state as Record<string, unknown> | null)?.[KEY];
  return typeof value === "object" && value !== null ? (value as EntryState) : {};
};

export const readHistoryEntry = (name: string): string | null => {
  const value = entryOf()[name];
  return typeof value === "string" ? value : null;
};

export const writeHistoryEntry = (name: string, value: string | null) => {
  if (typeof window === "undefined" || entryOf()[name] === (value ?? undefined)) {
    return;
  }
  const state = (window.history.state as Record<string, unknown> | null) ?? {};
  const next = { ...entryOf() };
  if (value === null) {
    delete next[name];
  } else {
    next[name] = value;
  }
  window.history.replaceState({ ...state, [KEY]: next }, "");
};

/**
 * A history-entry value for rendering: null on the server and during hydration,
 * read once after (a per-mount store that notifies exactly once on subscribe,
 * like useMountedNow, so React re-renders with it).
 */
export const createHistoryEntryStore = (name: string) => {
  let value: string | null | undefined;
  return {
    subscribe(listener: () => void) {
      if (value === undefined) {
        value = readHistoryEntry(name);
        listener();
      }
      return () => {};
    },
    getSnapshot: () => value ?? null,
    getServerSnapshot: () => null,
  };
};
