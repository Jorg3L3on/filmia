"use client";

import { useSyncExternalStore } from "react";
import { SuccessToast } from "@/components/SuccessToast";
import { cn } from "@/lib/cn";
import {
  dismissToast,
  getToasts,
  getToastsSnapshot,
  subscribeToasts,
} from "@/lib/toast";
import { toastLayerClass } from "@/lib/ui";

export const ToastHost = () => {
  const toasts = useSyncExternalStore(
    subscribeToasts,
    getToasts,
    getToastsSnapshot,
  );

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] flex flex-col items-center gap-2 px-4 sm:bottom-8",
        toastLayerClass,
      )}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-full max-w-md">
          <SuccessToast
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            onDismiss={() => dismissToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};
