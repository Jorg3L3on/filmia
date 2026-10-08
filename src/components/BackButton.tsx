"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { useNavOrigin } from "@/components/NavOriginTracker";
import { cn } from "@/lib/cn";
import { HOME_ENTRY } from "@/lib/nav-origin";
import { glassIconClass } from "@/lib/ui";

type BackButtonProps = {
  className?: string;
  /** Disc only (the label stays as the accessible name). */
  compact?: boolean;
  /** Hide entirely when the page was not opened from another Filmia page (Buscar, F6). */
  hideWithoutOrigin?: boolean;
};

/**
 * «‹ Hoy · Terror»: back to the exact page this one was opened from. Same
 * result as the browser / iOS edge-swipe back when the origin is the previous
 * history entry; a direct link or a cold PWA start pushes the origin, or Hoy.
 */
export const BackButton = ({ className, compact = false, hideWithoutOrigin = false }: BackButtonProps) => {
  const router = useRouter();
  const { origin, label, action } = useNavOrigin();

  if (hideWithoutOrigin && !origin) {
    return null;
  }

  const href = origin?.href ?? HOME_ENTRY.href;
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const next = action();
    if (next.kind === "back") {
      router.back();
    } else {
      router.push(next.href);
    }
  };

  return (
    <Link
      href={href}
      prefetch={false}
      onClick={handleClick}
      aria-label={`Volver a ${label}`}
      className={cn(
        glassIconClass,
        compact ? "size-10" : "h-10 max-w-[min(15rem,60vw)] gap-0.5 pl-1.5 pr-4 text-sm font-semibold",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-5 shrink-0"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {compact ? null : <span className="truncate">{label}</span>}
    </Link>
  );
};
