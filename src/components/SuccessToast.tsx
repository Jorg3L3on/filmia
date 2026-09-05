"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type SuccessToastProps = {
  title: string;
  description?: string;
};

export const SuccessToast = ({ title, description }: SuccessToastProps) => {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!open) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success-well px-4 py-3 text-sm text-paper"
    >
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-ink"
        aria-hidden="true"
      >
        ✓
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-success">{title}</p>
        {description ? <p className="text-fog">{description}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Cerrar aviso"
        className={cn("rounded-full px-1 text-mist hover:text-paper", focusRing)}
      >
        ×
      </button>
    </div>
  );
};
