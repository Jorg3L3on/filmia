"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

/**
 * A person in «Ven hoy» (UX-18): a real toggle button, so a screen reader says whether they are
 * included. The URL still carries who watches (replace, no scroll), as the link did.
 */
export const WatchingToggle = ({
  href,
  on,
  label,
  children,
}: {
  href: string;
  on: boolean;
  label: string;
  children: ReactNode;
}) => {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${label}, ${on ? "incluida" : "no incluida"}`}
      onClick={() => router.replace(href, { scroll: false })}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors",
        on ? "border-affinity/50 bg-affinity/[0.12] text-paper" : "border-white/10 bg-white/[0.03] text-fog hover:text-paper",
        focusRing,
      )}
    >
      {children}
    </button>
  );
};
