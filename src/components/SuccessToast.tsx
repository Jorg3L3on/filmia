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
  const [phase, setPhase] = useState<"in" | "out">("in");
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const duration = variant === "error" ? 4500 : 3200;
    const timer = window.setTimeout(() => {
      setPhase("out");
    }, duration);
    return () => window.clearTimeout(timer);
  }, [variant]);

  useEffect(() => {
    if (phase !== "out") {
      return;
    }

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => onDismissRef.current?.(),
      reduced ? 20 : 280,
    );
    return () => window.clearTimeout(timer);
  }, [phase]);

  const handleDismiss = () => {
    setPhase("out");
  };

  const isError = variant === "error";

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm text-paper shadow-[0_12px_32px_rgba(0,0,0,0.35)]",
        phase === "out" ? "toast-out" : "toast-in",
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
