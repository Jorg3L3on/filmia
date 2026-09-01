"use client";

import { cn } from "@/lib/cn";

export type DeckViewMode = "deck" | "grid";

type DeckViewToggleProps = {
  mode: DeckViewMode;
  onChange: (mode: DeckViewMode) => void;
  className?: string;
};

export const DeckViewToggle = ({ mode, onChange, className }: DeckViewToggleProps) => {
  return (
    <div
      role="group"
      aria-label="Modo de visualización"
      className={cn(
        "inline-flex rounded-full border border-[#2c3440] bg-[#14181c] p-1",
        className,
      )}
    >
      <button
        type="button"
        aria-pressed={mode === "deck"}
        onClick={() => onChange("deck")}
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e054]",
          mode === "deck"
            ? "bg-[#00e054] text-[#14181c]"
            : "text-[#99aabb] hover:text-white",
        )}
      >
        Mazo
      </button>
      <button
        type="button"
        aria-pressed={mode === "grid"}
        onClick={() => onChange("grid")}
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e054]",
          mode === "grid"
            ? "bg-[#00e054] text-[#14181c]"
            : "text-[#99aabb] hover:text-white",
        )}
      >
        Cuadrícula
      </button>
    </div>
  );
};
