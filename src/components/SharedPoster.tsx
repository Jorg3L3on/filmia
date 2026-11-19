"use client";

import { ViewTransition, useLayoutEffect, useRef, useState } from "react";
import { posterTransitionName } from "@/lib/motion-ids";
import { cn } from "@/lib/cn";
import { cssTimeMs, flipFrom, posterFlightFor, rememberPosterRect, takePosterReturn } from "@/lib/poster-flight";

/**
 * Back from a ficha (FIL-I46-2): a history traversal runs no view transition, so the poster
 * flies home itself, from where the ficha's poster was, on the cut curve. Transform only.
 */
const usePosterReturn = (titleId: string, enabled: boolean) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!enabled || !node) return;
    const from = takePosterReturn(titleId);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (from && !reduced && typeof node.animate === "function") {
      const to = node.getBoundingClientRect();
      const { x, y, sx, sy } = flipFrom(from, to);
      const root = getComputedStyle(document.documentElement);
      const duration = cssTimeMs(root.getPropertyValue("--duration-morph"));
      node.animate(
        [
          { transformOrigin: "0 0", transform: `translate(${x}px, ${y}px) scale(${sx}, ${sy})` },
          { transformOrigin: "0 0", transform: "none" },
        ],
        { duration, easing: root.getPropertyValue("--ease-cut").trim() || "ease-out" },
      );
    }
    // Where it sits now, in page coordinates: by the time it unmounts it may be detached.
    const placed = node.getBoundingClientRect();
    const page = { x: placed.x + window.scrollX, y: placed.y + window.scrollY, width: placed.width, height: placed.height };
    return () => {
      const rect = node.isConnected ? node.getBoundingClientRect() : null;
      rememberPosterRect(
        titleId,
        rect && rect.width > 0
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          : { ...page, x: page.x - window.scrollX, y: page.y - window.scrollY },
      );
    };
  }, [titleId, enabled]);
  return ref;
};

type SharedPosterProps = {
  titleId: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Shared-element morph into the title page. Disable in grids/stacks where the
   * same titleId can appear more than once on screen (ViewTransition names must
   * be unique).
   */
  share?: boolean;
};

export const SharedPoster = ({
  titleId,
  children,
  className,
  share = true,
}: SharedPosterProps) => {
  const ref = usePosterReturn(titleId, share);
  // The image that just flew here (FIL-I60-6): painted under the poster until its own, often
  // larger, image has loaded, so the hero never shows an empty block after the morph.
  const [flight] = useState(() => (share ? posterFlightFor(titleId) : null));
  if (!share) {
    return <div className={className}>{children}</div>;
  }

  return (
    <ViewTransition name={posterTransitionName(titleId)} share="morph" default="none">
      {/* data-shared-poster: the tap that opens the ficha remembers this image (FIL-I46-2). */}
      <div
        ref={ref}
        className={cn(className, flight && "has-flight rounded-poster bg-cover bg-center")}
        style={flight ? { backgroundImage: `url("${flight}")` } : undefined}
        data-shared-poster={titleId}
      >
        {children}
      </div>
    </ViewTransition>
  );
};
