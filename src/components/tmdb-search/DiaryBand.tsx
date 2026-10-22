"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { diaryDayLabel } from "@/lib/title-preview";
import { focusRing } from "@/lib/ui";

/**
 * Diario mode made visible (FIL-I22-3): the day being logged, under the chips,
 * with ✕ back to the same search outside Diario. 40 px, green like the check.
 */
export const DiaryBand = ({ date, exitHref }: { date: string | null; exitHref: string }) => (
  <div
    role="status"
    data-diary-band
    className="flex h-10 items-center gap-2 rounded-full bg-success-well pr-1 pl-3 text-sm text-success"
  >
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5 9.5-10" />
    </svg>
    <p className="min-w-0 flex-1 truncate">
      <span className="font-medium">Diario · {diaryDayLabel(date)}</span>
      <span className="text-success/80"> · toca el check para registrar ese día</span>
    </p>
    <Link
      href={exitHref}
      aria-label="Salir del modo Diario"
      className={cn("press-scale flex size-8 shrink-0 items-center justify-center rounded-full text-success hover:bg-success/20", focusRing)}
    >
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </Link>
  </div>
);
