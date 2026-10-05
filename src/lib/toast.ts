export type ToastVariant = "success" | "error";

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
  /** Override auto-dismiss (ms). */
  durationMs?: number;
};

export type ToastItem = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  action?: ToastAction;
  durationMs?: number;
};

const EMPTY: ToastItem[] = [];
const MAX_TOASTS = 3;

let nextId = 1;
let items: ToastItem[] = EMPTY;
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

export const showToast = (payload: ToastPayload) => {
  const next: ToastItem = {
    id: nextId,
    title: payload.title,
    description: payload.description,
    variant: payload.variant ?? "success",
    action: payload.action,
    durationMs: payload.durationMs,
  };
  nextId += 1;
  items = [...items.slice(-(MAX_TOASTS - 1)), next];
  emit();
  return next.id;
};

export const dismissToast = (id: number) => {
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) {
    return;
  }
  items = next.length === 0 ? EMPTY : next;
  emit();
};

export const subscribeToasts = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getToasts = () => items;

export const getToastsSnapshot = () => EMPTY;
