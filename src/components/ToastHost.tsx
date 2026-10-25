"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ToastCard } from "@/components/Toast";
import { cn } from "@/lib/cn";
import {
  dismissToast,
  getToasts,
  getToastsSnapshot,
  pauseAllToasts,
  resumeAllToasts,
  subscribeToasts,
  type ToastItem,
} from "@/lib/toast";
import { safeAreaInsetXPadClass, toastLayerClass } from "@/lib/ui";

const EXIT_MS = 280;
const EXIT_REDUCED_MS = 120;

/** 12 px above the h-16 dock (plus its 12 px float), then the home indicator. Desktop: 32 px. */
const toastBottomClass =
  "bottom-[calc(4rem+0.75rem+max(env(safe-area-inset-bottom),0.75rem))] sm:bottom-8";

/** /buscar parks the dock at the top, so the toast comes down to the safe area. */
const toastBuscarClass = "bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:bottom-8";

export const ToastHost = () => {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToastsSnapshot);
  const dockOnTop = usePathname()?.startsWith("/buscar") ?? false;
  const regionRef = useRef<HTMLElement>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [ghosts, setGhosts] = useState<ToastItem[]>([]);
  const [previous, setPrevious] = useState(toasts);

  if (previous !== toasts) {
    const liveIds = new Set(toasts.map((toast) => toast.id));
    const removed = previous.filter((toast) => !liveIds.has(toast.id));
    setPrevious(toasts);
    if (removed.length > 0) {
      setGhosts((current) => [...current.filter((ghost) => !liveIds.has(ghost.id)), ...removed]);
    } else if (ghosts.some((ghost) => liveIds.has(ghost.id))) {
      setGhosts((current) => current.filter((ghost) => !liveIds.has(ghost.id)));
    }
  }

  useEffect(() => {
    if (ghosts.length === 0) {
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setGhosts([]), reduced ? EXIT_REDUCED_MS : EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [ghosts]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        pauseAllToasts("hidden");
        return;
      }
      resumeAllToasts("hidden");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      resumeAllToasts("hidden");
    };
  }, []);

  useEffect(() => {
    const syncKeyboard = () => {
      const viewport = window.visualViewport;
      const inset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      const styled = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--keyboard-inset"),
      );
      setKeyboardOpen(Math.max(inset, Number.isFinite(styled) ? styled : 0) > 80);
    };
    syncKeyboard();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", syncKeyboard);
    viewport?.addEventListener("scroll", syncKeyboard);
    window.addEventListener("resize", syncKeyboard);
    return () => {
      viewport?.removeEventListener("resize", syncKeyboard);
      viewport?.removeEventListener("scroll", syncKeyboard);
      window.removeEventListener("resize", syncKeyboard);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === "KeyT") {
        event.preventDefault();
        regionRef.current?.focus();
        return;
      }
      if (event.key !== "Escape" || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (document.documentElement.hasAttribute("data-sheet-open")) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      const newest = getToasts().reduce<ToastItem | null>(
        (current, toast) => (current == null || toast.id > current.id ? toast : current),
        null,
      );
      if (!newest) {
        return;
      }
      event.preventDefault();
      dismissToast(newest.id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const rows = [
    ...toasts.map((toast) => ({ toast, phase: "in" as const })),
    ...ghosts.map((toast) => ({ toast, phase: "out" as const })),
  ].sort((a, b) => a.toast.id - b.toast.id);

  return (
    <section
      ref={regionRef}
      tabIndex={-1}
      aria-live="polite"
      aria-relevant="additions text"
      aria-atomic="false"
      aria-label="Avisos"
      data-dock={dockOnTop ? "top" : "bottom"}
      data-keyboard={keyboardOpen ? "open" : "closed"}
      className={cn(
        "toast-host pointer-events-none fixed inset-x-0 flex flex-col items-center gap-2 outline-none",
        safeAreaInsetXPadClass,
        dockOnTop ? toastBuscarClass : toastBottomClass,
        toastLayerClass,
      )}
    >
      {rows.map(({ toast, phase }) => (
        <div key={`${toast.id}-${phase}`} className="pointer-events-auto w-full sm:w-[420px]">
          <ToastCard toast={toast} phase={phase} onDismiss={() => dismissToast(toast.id)} />
        </div>
      ))}
    </section>
  );
};
