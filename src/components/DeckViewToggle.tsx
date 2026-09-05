import Link from "next/link";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export type DeckViewMode = "deck" | "grid" | "calendar";

export const DIARY_VIEW_MODES: DeckViewMode[] = ["calendar", "deck", "grid"];

type DeckViewToggleProps = {
  mode: DeckViewMode;
  hrefFor: (mode: DeckViewMode) => string;
  modes?: DeckViewMode[];
  className?: string;
  variant?: "pills" | "icons";
};

const MODE_LABEL: Record<DeckViewMode, string> = {
  deck: "Mazo",
  grid: "Cuadrícula",
  calendar: "Calendario",
};

export const DeckViewToggle = ({
  mode,
  hrefFor,
  modes = ["deck", "grid"],
  className,
  variant = "pills",
}: DeckViewToggleProps) => {
  const isIcons = variant === "icons";

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
            aria-label={MODE_LABEL[item]}
            title={MODE_LABEL[item]}
            className={cn(
              "inline-flex items-center justify-center rounded-full transition",
              focusRing,
              isIcons ? "size-9" : "px-3 py-1.5 text-xs font-medium uppercase tracking-wide",
              isCurrent
                ? "bg-accent text-ink"
                : "text-fog hover:text-paper",
            )}
          >
            {isIcons ? <ViewModeIcon mode={item} /> : MODE_LABEL[item]}
          </Link>
        );
      })}
    </div>
  );
};

const ViewModeIcon = ({ mode }: { mode: DeckViewMode }) => {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    className: "h-4 w-4",
    "aria-hidden": true,
  } as const;

  if (mode === "calendar") {
    return (
      <svg {...common}>
        <rect x="4.5" y="6" width="15" height="13.5" rx="2" />
        <path strokeLinecap="round" d="M4.5 10.5h15M8 4.5v3M16 4.5v3" />
      </svg>
    );
  }

  if (mode === "grid") {
    return (
      <svg {...common}>
        <rect x="5" y="5" width="6" height="6" rx="1" />
        <rect x="13" y="5" width="6" height="6" rx="1" />
        <rect x="5" y="13" width="6" height="6" rx="1" />
        <rect x="13" y="13" width="6" height="6" rx="1" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect x="7" y="5" width="10" height="14" rx="1.5" />
      <path d="M5.5 7.5v9M18.5 7.5v9" />
    </svg>
  );
};
