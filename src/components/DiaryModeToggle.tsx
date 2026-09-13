import Link from "next/link";
import { cn } from "@/lib/cn";
import { diaryModeHref, type DiaryMode } from "@/lib/diary-picks";
import { focusRing } from "@/lib/ui";

type DiaryModeToggleProps = {
  mode: DiaryMode;
};

const MODES: Array<{ id: DiaryMode; label: string }> = [
  { id: "picks", label: "Qué ver" },
  { id: "historial", label: "Historial" },
];

export const DiaryModeToggle = ({ mode }: DiaryModeToggleProps) => {
  return (
    <div
      role="tablist"
      aria-label="Modo del diario"
      className="diario-mode-toggle mx-auto flex w-full max-w-xs rounded-full border border-chrome/80 bg-well/80 p-0.5 sm:max-w-sm sm:p-1"
    >
      {MODES.map((item) => {
        const isCurrent = mode === item.id;
        return (
          <Link
            key={item.id}
            href={diaryModeHref(item.id)}
            role="tab"
            aria-selected={isCurrent}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] tab-transition sm:px-4 sm:py-2 sm:text-xs",
              focusRing,
              isCurrent
                ? "bg-accent/90 text-ink"
                : "text-fog hover:text-paper",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
};
