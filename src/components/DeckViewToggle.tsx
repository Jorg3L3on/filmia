import Link from "next/link";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export type DeckViewMode = "deck" | "grid";

type DeckViewToggleProps = {
  mode: DeckViewMode;
  hrefFor: (mode: DeckViewMode) => string;
  modes?: DeckViewMode[];
  className?: string;
};

const MODE_LABEL: Record<DeckViewMode, string> = {
  deck: "Mazo",
  grid: "Cuadrícula",
};

export const DeckViewToggle = ({
  mode,
  hrefFor,
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
      {modes.map((item) => {
        const isCurrent = mode === item;
        return (
          <Link
            key={item}
            href={hrefFor(item)}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition",
              focusRing,
              isCurrent
                ? "bg-accent text-ink"
                : "text-fog hover:text-white",
            )}
          >
            {MODE_LABEL[item]}
          </Link>
        );
      })}
    </div>
  );
};
