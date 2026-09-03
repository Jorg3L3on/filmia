"use client";

import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export type DeckViewMode = "calendar" | "deck" | "grid";

type DeckViewToggleProps = {
  mode: DeckViewMode;
  onChange: (mode: DeckViewMode) => void;
  modes?: DeckViewMode[];
  className?: string;
};

const MODE_LABEL: Record<DeckViewMode, string> = {
  calendar: "Calendario",
  deck: "Mazo",
  grid: "Cuadrícula",
};

export const DeckViewToggle = ({
  mode,
  onChange,
  modes = ["deck", "grid"],
  className,
}: DeckViewToggleProps) => {
  return (
    <div
      role="group"
      aria-label="Modo de visualización"
      className={cn(
        "inline-flex rounded-full border border-chrome bg-well p-1",
        className,
      )}
    >
      {modes.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={mode === item}
          onClick={() => onChange(item)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition",
            focusRing,
            mode === item
              ? "bg-accent text-ink"
              : "text-fog hover:text-white",
          )}
        >
          {MODE_LABEL[item]}
        </button>
      ))}
    </div>
  );
};
