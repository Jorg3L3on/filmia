"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import type { ToastVariant } from "@/lib/toast";

type SuccessToastProps = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  onDismiss?: () => void;
};

export const SuccessToast = ({
  title,
  description,
  variant = "success",
  onDismiss,
}: SuccessToastProps) => {
  const [open, setOpen] = useState(true);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOpen(false);
      onDismissRef.current?.();
    }, 5000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!open) {
    return null;
  }

  const handleDismiss = () => {
    setOpen(false);
    onDismissRef.current?.();
  };

  const isError = variant === "error";

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm text-paper shadow-[0_12px_32px_rgba(0,0,0,0.35)]",
        isError
          ? "border-danger-line bg-danger-well"
          : "border-success/30 bg-success-well",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink",
          isError ? "bg-danger text-paper" : "bg-success text-ink",
        )}
        aria-hidden="true"
      >
        {isError ? "!" : "✓"}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold", isError ? "text-danger" : "text-success")}>
          {title}
        </p>
        {description ? <p className="text-fog">{description}</p> : null}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Cerrar aviso"
        className={cn("rounded-full px-1 text-mist hover:text-paper", focusRing)}
      >
        ×
      </button>
    </div>
  );
};
