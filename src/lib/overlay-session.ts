/**
 * Scroll lock, focus trap and Escape for stacked overlays (sheets and the crystal
 * confirm dialog). Only the top layer hears Tab and Escape. Scroll locks are counted
 * so a dialog over a sheet does not unlock the page when the top one closes.
 */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

type FocusTarget = {
  focus: (options?: { preventScroll?: boolean }) => void;
};

type Focusable = FocusTarget & {
  getClientRects: () => ArrayLike<unknown>;
};

export type OverlayPanel = FocusTarget & {
  contains: (node: Node | null) => boolean;
  querySelectorAll: (selectors: string) => ArrayLike<Focusable>;
};

type StyleHost = { style: { overflow: string } };

export type OverlayEnv = {
  document: {
    documentElement: StyleHost & {
      style: StyleHost["style"] & {
        setProperty: (property: string, value: string) => void;
        removeProperty: (property: string) => string;
      };
    };
    body: StyleHost;
    activeElement: unknown;
  };
  window: {
    addEventListener: (type: "keydown", listener: (event: KeyboardEvent) => void) => void;
    removeEventListener: (type: "keydown", listener: (event: KeyboardEvent) => void) => void;
    requestAnimationFrame: (callback: () => void) => number;
    cancelAnimationFrame: (handle: number) => void;
    innerHeight: number;
    visualViewport?: {
      height: number;
      offsetTop: number;
      addEventListener: (type: "resize" | "scroll", listener: () => void) => void;
      removeEventListener: (type: "resize" | "scroll", listener: () => void) => void;
    } | null;
  };
};

export type OverlaySessionOptions = {
  panel: () => OverlayPanel | null;
  onClose: () => void;
  /** Focused when the layer opens. Falls back to the panel. */
  initialFocus?: () => FocusTarget | null;
  env?: OverlayEnv;
};

const stack: symbol[] = [];
let scrollLocks = 0;
let savedOverflow: { html: string; body: string } | null = null;

const canFocus = (value: unknown): value is Focusable & { isConnected?: boolean } =>
  !!value && typeof value === "object" && typeof (value as Focusable).focus === "function";

const lockScroll = (doc: OverlayEnv["document"]) => {
  scrollLocks += 1;
  if (scrollLocks > 1) {
    return;
  }
  savedOverflow = {
    html: doc.documentElement.style.overflow,
    body: doc.body.style.overflow,
  };
  // iOS ignores overflow on <body> alone; locking <html> too stops the page behind.
  doc.documentElement.style.overflow = "hidden";
  doc.body.style.overflow = "hidden";
};

const unlockScroll = (doc: OverlayEnv["document"]) => {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks > 0 || !savedOverflow) {
    return;
  }
  doc.documentElement.style.overflow = savedOverflow.html;
  doc.body.style.overflow = savedOverflow.body;
  savedOverflow = null;
};

const trapTab = (
  event: KeyboardEvent,
  panel: OverlayPanel,
  active: unknown,
) => {
  const focusable = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
    (element) => element.getClientRects().length > 0,
  );
  if (focusable.length === 0) {
    event.preventDefault();
    panel.focus({ preventScroll: true });
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
};

const browserEnv = (): OverlayEnv => ({
  document: document as unknown as OverlayEnv["document"],
  window: window as unknown as OverlayEnv["window"],
});

/** Opens one layer. The returned function releases it and restores focus. */
export const openOverlaySession = ({
  panel,
  onClose,
  initialFocus,
  env,
}: OverlaySessionOptions) => {
  const resolved = env ?? browserEnv();
  const { document: doc, window: win } = resolved;
  const id = Symbol("overlay");
  stack.push(id);
  lockScroll(doc);

  const root = doc.documentElement;
  const previouslyFocused = canFocus(doc.activeElement) ? doc.activeElement : null;
  const focusFrame = win.requestAnimationFrame(() => {
    const node = panel();
    const preferred = initialFocus?.() ?? null;
    if (preferred && node?.contains(preferred as unknown as Node)) {
      preferred.focus({ preventScroll: true });
      return;
    }
    if (node && !node.contains((doc.activeElement as Node | null) ?? null)) {
      node.focus({ preventScroll: true });
    }
  });

  const handleKeyDown = (event: KeyboardEvent) => {
    if (stack[stack.length - 1] !== id) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "Tab") {
      const node = panel();
      if (node) {
        trapTab(event, node, doc.activeElement);
      }
    }
  };

  const viewport = win.visualViewport;
  const syncKeyboardInset = () => {
    if (!viewport) {
      return;
    }
    const inset = Math.max(0, win.innerHeight - viewport.height - viewport.offsetTop);
    root.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
  };
  syncKeyboardInset();
  viewport?.addEventListener("resize", syncKeyboardInset);
  viewport?.addEventListener("scroll", syncKeyboardInset);
  win.addEventListener("keydown", handleKeyDown);

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    win.cancelAnimationFrame(focusFrame);
    const index = stack.indexOf(id);
    if (index !== -1) {
      stack.splice(index, 1);
    }
    unlockScroll(doc);
    win.removeEventListener("keydown", handleKeyDown);
    viewport?.removeEventListener("resize", syncKeyboardInset);
    viewport?.removeEventListener("scroll", syncKeyboardInset);
    if (stack.length === 0) {
      root.style.removeProperty("--keyboard-inset");
    }
    if (previouslyFocused && previouslyFocused.isConnected !== false) {
      previouslyFocused.focus({ preventScroll: true });
    }
  };
};

/** Test isolation: the lock counter is process-wide. */
export const resetOverlaySessionForTests = () => {
  stack.length = 0;
  scrollLocks = 0;
  savedOverflow = null;
};
