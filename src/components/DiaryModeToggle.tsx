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
      className="inline-flex rounded-full border border-chrome bg-well p-1"
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
              "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition spring-fill",
              focusRing,
              isCurrent ? "bg-accent text-ink shadow-[0_6px_16px_rgba(124,156,255,0.28)]" : "text-fog hover:text-paper",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
};
