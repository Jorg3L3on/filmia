export type ToastVariant = "success" | "error" | "info" | "progress" | "warning";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastPayload = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Optional inline action (e.g. «Deshacer»). */
  action?: ToastAction;
  /** Override auto-dismiss (ms). `0` is honored. */
  durationMs?: number;
  /**
   * Dedupe / in-place update. Separate from the numeric `id` `showToast` returns.
   * The same `key` replaces the live toast instead of stacking another.
   */
  key?: string;
  /** Poster URL. Decorative; the title carries the name. */
  poster?: string;
  /** 0–1, for `progress`. */
  progress?: number;
  /** Force the toast to stay (`true`) or to use a timed fallback (`false`). */
  persistent?: boolean;
};

export type ToastItem = {
  id: number;
  key?: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  action?: ToastAction;
  poster?: string;
  progress?: number;
  /** Identical non-error bursts collapse into one toast and count here. */
  count: number;
  /** `null` stays until dismissed (progress, warning, error with an action). */
  durationMs: number | null;
  remainingMs: number | null;
  /** Epoch ms when the timer fires. `null` while paused or persistent. */
  deadline: number | null;
  held: boolean;
};

export type ToastHold = "hover" | "focus" | "press" | "hidden";

/** Sparse update. A present `action` / `description` / `poster` replaces; omit to keep. */
export type ToastPatch = Partial<Omit<ToastPayload, "key">>;

const EMPTY: ToastItem[] = [];
const MAX_TOASTS = 3;
const WARNING_TIMED_MS = 8000;

const SUCCESS_MS = 4000;
const INFO_MS = 5000;
const UNDO_MS = 7000;
const ERROR_MS = 8000;

let nextId = 1;
let items: ToastItem[] = EMPTY;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const holds = new Map<number, Set<ToastHold>>();
const timing = new Map<number, { durationMs?: number; persistent?: boolean }>();

const emit = () => {
  items = items === EMPTY ? EMPTY : items.slice();
  listeners.forEach((listener) => listener());
};

const clampProgress = (value: number | undefined) => {
  if (value == null || Number.isNaN(value)) {
    return undefined;
  }
  return Math.min(1, Math.max(0, value));
};

const isUndo = (action: ToastAction | undefined) =>
  action?.label.trim().toLowerCase() === "deshacer";

/**
 * Default lifetimes. An explicit `durationMs` wins, then `persistent: true`,
 * then «Deshacer» (7 s), then the variant. Warning and an error that offers
 * an action stay up; `persistent: false` gives those an 8 s fallback.
 */
export const resolveToastDuration = (payload: {
  variant?: ToastVariant;
  action?: ToastAction;
  durationMs?: number;
  persistent?: boolean;
}): number | null => {
  if (payload.durationMs != null) {
    return payload.durationMs;
  }
  if (payload.persistent === true) {
    return null;
  }
  if (isUndo(payload.action)) {
    return UNDO_MS;
  }
  const variant = payload.variant ?? "success";
  if (variant === "success") {
    return SUCCESS_MS;
  }
  if (variant === "info") {
    return INFO_MS;
  }
  if (variant === "error") {
    if (payload.action && payload.persistent !== false) {
      return null;
    }
    return ERROR_MS;
  }
  if (payload.persistent === false) {
    return WARNING_TIMED_MS;
  }
  return null;
};

const clearTimer = (id: number) => {
  const timer = timers.get(id);
  if (timer == null) {
    return;
  }
  clearTimeout(timer);
  timers.delete(id);
};

const forget = (id: number) => {
  clearTimer(id);
  holds.delete(id);
  timing.delete(id);
};

const schedule = (item: ToastItem) => {
  clearTimer(item.id);
  if (item.held || item.durationMs == null || item.remainingMs == null) {
    item.deadline = null;
    return;
  }
  item.deadline = Date.now() + item.remainingMs;
  const timer = setTimeout(() => {
    timers.delete(item.id);
    dismissToast(item.id);
  }, item.remainingMs);
  timers.set(item.id, timer);
};

const freeze = (item: ToastItem) => {
  if (item.durationMs == null || item.remainingMs == null) {
    item.deadline = null;
    return;
  }
  if (item.deadline != null) {
    item.remainingMs = Math.max(0, item.deadline - Date.now());
  }
  item.deadline = null;
  clearTimer(item.id);
};

const materialize = (
  id: number,
  payload: ToastPayload,
  count: number,
  held: boolean,
): ToastItem => {
  const durationMs = resolveToastDuration(payload);
  timing.set(id, { durationMs: payload.durationMs, persistent: payload.persistent });
  return {
    id,
    key: payload.key,
    title: payload.title,
    description: payload.description,
    variant: payload.variant ?? "success",
    action: payload.action,
    poster: payload.poster,
    progress: clampProgress(payload.progress),
    count,
    durationMs,
    remainingMs: durationMs,
    deadline: null,
    held,
  };
};

const writeAt = (index: number, next: ToastItem) => {
  const copy = items.slice();
  copy[index] = next;
  items = copy;
  schedule(next);
  emit();
};

const sameCopy = (item: ToastItem, payload: ToastPayload) =>
  item.title === payload.title && (item.description ?? "") === (payload.description ?? "");

/**
 * Drop the oldest non-error so a new toast fits. Errors are never evicted to
 * make room for anything else; when every slot is an error, a non-error is
 * refused and a new error takes the oldest error's slot.
 */
const makeRoom = (incoming: ToastVariant) => {
  if (items.length < MAX_TOASTS) {
    return true;
  }
  const nonError = items.findIndex((item) => item.variant !== "error");
  if (incoming !== "error" && nonError === -1) {
    return false;
  }
  const index = nonError === -1 ? 0 : nonError;
  const removed = items[index];
  if (!removed) {
    return false;
  }
  forget(removed.id);
  const copy = items.slice();
  copy.splice(index, 1);
  items = copy;
  return true;
};

export const showToast = (payload: ToastPayload) => {
  const variant = payload.variant ?? "success";

  if (payload.key) {
    const index = items.findIndex((item) => item.key === payload.key);
    const existing = items[index];
    if (existing) {
      const next = materialize(existing.id, payload, 1, existing.held);
      writeAt(index, next);
      return existing.id;
    }
  }

  if (variant === "error" && !payload.key) {
    const index = items.findIndex(
      (item) => item.variant === "error" && !item.key && sameCopy(item, payload),
    );
    const existing = items[index];
    if (existing) {
      const next = materialize(existing.id, payload, 1, existing.held);
      writeAt(index, next);
      return existing.id;
    }
  }

  if (variant !== "error" && !payload.key) {
    const index = items.findIndex(
      (item) => item.variant === variant && !item.key && sameCopy(item, payload),
    );
    const existing = items[index];
    if (existing) {
      const next = materialize(existing.id, payload, existing.count + 1, existing.held);
      writeAt(index, next);
      return existing.id;
    }
  }

  if (!makeRoom(variant)) {
    return -1;
  }

  const id = nextId;
  nextId += 1;
  const next = materialize(id, payload, 1, false);
  items = [...items, next];
  schedule(next);
  emit();
  return id;
};

export const updateToast = (key: string, patch: ToastPatch) => {
  const index = items.findIndex((item) => item.key === key);
  const current = items[index];
  if (!current) {
    return;
  }
  const prev = timing.get(current.id) ?? {};
  const durationMs = "durationMs" in patch ? patch.durationMs : prev.durationMs;
  const persistent = "persistent" in patch ? patch.persistent : prev.persistent;
  const variant = patch.variant ?? current.variant;
  const action = "action" in patch ? patch.action : current.action;
  const timingChanged =
    variant !== current.variant ||
    action !== current.action ||
    durationMs !== prev.durationMs ||
    persistent !== prev.persistent;
  timing.set(current.id, { durationMs, persistent });
  const resolved = resolveToastDuration({ variant, action, durationMs, persistent });
  const next: ToastItem = {
    ...current,
    title: patch.title ?? current.title,
    description: "description" in patch ? patch.description : current.description,
    variant,
    action,
    poster: "poster" in patch ? patch.poster : current.poster,
    progress: "progress" in patch ? clampProgress(patch.progress) : current.progress,
    durationMs: timingChanged ? resolved : current.durationMs,
    remainingMs: timingChanged ? resolved : current.remainingMs,
    deadline: timingChanged ? null : current.deadline,
  };
  const copy = items.slice();
  copy[index] = next;
  items = copy;
  if (timingChanged) {
    schedule(next);
  }
  emit();
};

export const dismissToast = (id: number) => {
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) {
    return;
  }
  forget(id);
  items = next.length === 0 ? EMPTY : next;
  emit();
};

const applyHold = (item: ToastItem, reason: ToastHold, held: boolean) => {
  let set = holds.get(item.id);
  if (!set) {
    set = new Set();
    holds.set(item.id, set);
  }
  const wasHeld = set.size > 0;
  if (held) {
    set.add(reason);
  } else {
    set.delete(reason);
  }
  const nowHeld = set.size > 0;
  if (wasHeld === nowHeld) {
    return false;
  }
  item.held = nowHeld;
  if (nowHeld) {
    freeze(item);
  } else {
    schedule(item);
  }
  return true;
};

export const pauseToast = (id: number, reason: ToastHold) => {
  const item = items.find((entry) => entry.id === id);
  if (!item || !applyHold(item, reason, true)) {
    return;
  }
  emit();
};

export const resumeToast = (id: number, reason: ToastHold) => {
  const item = items.find((entry) => entry.id === id);
  if (!item || !applyHold(item, reason, false)) {
    return;
  }
  emit();
};

export const pauseAllToasts = (reason: ToastHold) => {
  let changed = false;
  for (const item of items) {
    changed = applyHold(item, reason, true) || changed;
  }
  if (changed) {
    emit();
  }
};

export const resumeAllToasts = (reason: ToastHold) => {
  let changed = false;
  for (const item of items) {
    changed = applyHold(item, reason, false) || changed;
  }
  if (changed) {
    emit();
  }
};

/** Horizontal swipe dismisses at this speed (px/ms) or once it travels this far. */
export const SWIPE_VELOCITY = 0.11;
export const SWIPE_DISTANCE = 45;

export const shouldDismissSwipe = (distancePx: number, elapsedMs: number) => {
  const elapsed = Math.max(1, elapsedMs);
  return Math.abs(distancePx) / elapsed >= SWIPE_VELOCITY || Math.abs(distancePx) >= SWIPE_DISTANCE;
};

/** An error that does not time out (it offers an action, or was forced persistent). */
export const isBlockingToast = (toast: Pick<ToastItem, "variant" | "durationMs">) =>
  toast.variant === "error" && toast.durationMs == null;

export const isUndoToast = (toast: Pick<ToastItem, "action" | "durationMs">) =>
  toast.durationMs != null && toast.action?.label.trim().toLowerCase() === "deshacer";

export const subscribeToasts = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getToasts = () => items;

export const getToastsSnapshot = () => EMPTY;

/** Dev bench and production gate (FIL-I27-4). The page also calls `notFound()` outside development. */
export const isToastBenchEnabled = (env: string | undefined = process.env.NODE_ENV) =>
  env === "development";
