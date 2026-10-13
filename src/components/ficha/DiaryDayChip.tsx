import Link from "next/link";
import { cn } from "@/lib/cn";
import { diaryDayLabel, diaryMonthHref, type DiaryLog } from "@/lib/title-preview";
import { focusRing } from "@/lib/ui";

/** Diario mode (FIL-I8): which day the ficha logs, and the way back to that month. */
export const DiaryDayChip = ({ log }: { log: DiaryLog }) => (
  <Link
    href={diaryMonthHref(log.date)}
    className={cn(
      "relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-success/35 bg-success-well/85 px-3 text-[13px] font-medium text-success backdrop-blur-md",
      focusRing,
    )}
  >
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
    Diario · {diaryDayLabel(log.date)}
  </Link>
);
