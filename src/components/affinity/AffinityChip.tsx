import type { AffinityLevel } from "@/lib/tonight/affinity";
import { cn } from "@/lib/cn";

const DOTS: Record<AffinityLevel, number> = { alta: 3, media: 2, baja: 1 };

type AffinityChipProps = {
  level: AffinityLevel;
  label: string;
  lowConfidence?: boolean;
  /** `row`: plain text in Buscar's data line. `ficha`: a pill among the hero chips. */
  variant?: "row" | "ficha";
  className?: string;
};

/**
 * «Para ti» (FIL-I9): how close a film is to your taste, as a three-dot meter and a
 * label («Muy tu estilo / Podría gustarte / Fuera de tu zona»). A `~` and a dashed
 * outline mark a low-confidence guess (your profile knows little about this film).
 */
export const AffinityChip = ({
  level,
  label,
  lowConfidence = false,
  variant = "row",
  className,
}: AffinityChipProps) => (
  <span
    className={cn(
      "affinity-chip",
      variant === "ficha" ? "affinity-chip-ficha" : "text-xs font-medium",
      className,
    )}
    data-level={level}
    data-low-confidence={lowConfidence ? "true" : undefined}
    title={lowConfidence ? `${label} (con pocos datos)` : label}
  >
    <span className="affinity-dots" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <i key={index} className={index < DOTS[level] ? "is-on" : undefined} />
      ))}
    </span>
    <span>
      {lowConfidence ? "~ " : null}
      {label}
    </span>
  </span>
);

/** Holds the chip's place while the ficha resolves the prediction. */
export const AffinityChipSkeleton = () => (
  <span className="shimmer inline-block h-7 w-[7.5rem] rounded-full" aria-hidden="true" />
);
