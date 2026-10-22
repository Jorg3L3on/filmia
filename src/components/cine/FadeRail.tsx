"use client";

import { useRef, type ReactNode } from "react";
import { useRailFade } from "@/components/cine/useRailFade";
import { cn } from "@/lib/cn";

/** A horizontal scroller whose edges fade where more hides (FIL-I23-4, P2): no blur, no per-frame work. */
export const FadeRail = ({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useRailFade(ref);
  return (
    <div ref={ref} role="list" aria-label={label} className={cn("rail cine-fade", className)}>
      {children}
    </div>
  );
};
