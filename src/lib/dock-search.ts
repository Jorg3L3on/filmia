/**
 * Buscar's field lives in the mobile dock (FIL-I3-3): on /buscar the dock
 * becomes [disc of the tab you came from] + [glass search field]. The dock is
 * layout chrome and the search state lives in the page, so this tiny store
 * bridges them: the field shows `query` and forwards edits to whoever
 * registered (TmdbSearchAdd). Anything typed before the page mounts waits in
 * `query` and is handed over on registration.
 */

export type DockSearchHandlers = {
  change: (value: string) => void;
  submit: () => void;
};

export type DockSearchState = {
  query: string;
};

const INITIAL: DockSearchState = { query: "" };

let state: DockSearchState = INITIAL;
let handlers: DockSearchHandlers | null = null;
/** Set by a tap on the dock's Buscar disc; the field takes it once it mounts. */
let focusPending = false;
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const set = (next: Partial<DockSearchState>) => {
  state = { ...state, ...next };
  emit();
};

export const dockSearch = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => state,
  getServerSnapshot: () => INITIAL,

  /** The field: the user typed. */
  type: (value: string) => {
    set({ query: value });
    handlers?.change(value);
  },
  /** The field: Enter. */
  submit: () => {
    handlers?.submit();
  },
  /** The page: its query changed (initial `?q=`, a reset). */
  syncFromPage: (query: string) => {
    if (state.query !== query) {
      set({ query });
    }
  },
  /** The page mounts; returns the query typed before it was ready ("" if none). */
  register: (next: DockSearchHandlers) => {
    handlers = next;
    return () => {
      if (handlers === next) {
        handlers = null;
      }
    };
  },
  pendingQuery: () => state.query,
  /** Dock disc tapped: focus the field once it is there. */
  requestFocus: () => {
    focusPending = true;
  },
  /** The field mounted: should it take focus? (once per tap) */
  takeFocusRequest: () => {
    const pending = focusPending;
    focusPending = false;
    return pending;
  },
  /** Leaving /buscar: the next visit starts from its own URL. */
  reset: (query = "") => set({ query }),
};

const LAST_TAB_KEY = "filmia:dock-last-tab";

/** The tab Buscar was opened from (the dock's left disc goes back to it). */
export const readLastDockTab = (): string | null => {
  try {
    return window.sessionStorage.getItem(LAST_TAB_KEY);
  } catch {
    return null;
  }
};

export const writeLastDockTab = (href: string) => {
  try {
    window.sessionStorage.setItem(LAST_TAB_KEY, href);
  } catch {
    // Private mode / blocked storage: the disc falls back to Hoy.
  }
};
