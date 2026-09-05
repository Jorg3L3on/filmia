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
      role="group"
      aria-label="Modo del diario"
      className="inline-flex rounded-full border border-chrome bg-well p-1"
    >
      {MODES.map((item) => {
        const isCurrent = mode === item.id;
        return (
          <Link
            key={item.id}
            href={diaryModeHref(item.id)}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition",
              focusRing,
              isCurrent ? "bg-accent text-ink" : "text-fog hover:text-paper",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
};
