"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { SuccessToast } from "@/components/SuccessToast";
import { cn } from "@/lib/cn";
import {
  dismissToast,
  getToasts,
  getToastsSnapshot,
  subscribeToasts,
} from "@/lib/toast";
import { safeAreaInsetXPadClass, toastLayerClass } from "@/lib/ui";

export const ToastHost = () => {
  const toasts = useSyncExternalStore(
    subscribeToasts,
    getToasts,
    getToastsSnapshot,
  );
  // On /buscar the dock sits at the top (FIL-I3): the toast can come down to the safe area (FIL-I22-7).
  const dockOnTop = usePathname()?.startsWith("/buscar") ?? false;

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 flex flex-col items-center gap-2 sm:bottom-8",
        dockOnTop ? "bottom-[calc(1.5rem+env(safe-area-inset-bottom))]" : "bottom-[calc(5.75rem+env(safe-area-inset-bottom))]",
        safeAreaInsetXPadClass,
        toastLayerClass,
      )}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-full max-w-md">
          <SuccessToast
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            action={toast.action}
            durationMs={toast.durationMs}
            onDismiss={() => dismissToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};
