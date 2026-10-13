"use client";

import { useEffect, useId, useState } from "react";
import { recordAffinityShown } from "@/app/actions/affinity";
import { AffinityChip } from "@/components/affinity/AffinityChip";
import { Sheet, SheetHandle } from "@/components/Sheet";
import type { FichaAffinity as FichaAffinityState } from "@/lib/affinity-store";
import { focusRing } from "@/lib/ui";
import { cn } from "@/lib/cn";

type FichaAffinityProps = {
  state: FichaAffinityState;
  titleName: string;
};

/**
 * The ficha's «Para ti» chip (FIL-I9-4). Tapping it opens «¿Por qué?»: what the level
 * means and up to three reasons from the engine. Cold start: a quiet glass chip that
 * says how many more rated watches it needs.
 */
export const FichaAffinity = ({ state, titleName }: FichaAffinityProps) => {
  const [open, setOpen] = useState(false);
  const headingId = useId();

  // Telemetry (FIL-I9-5): the level this ficha showed, to compare with your rating later.
  const shown = state.kind === "prediction" ? state : null;
  useEffect(() => {
    if (shown) {
      void recordAffinityShown(shown.catalogId, shown.affinity.level, shown.affinity.lowConfidence);
    }
  }, [shown?.catalogId, shown?.affinity.level, shown?.affinity.lowConfidence]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.kind === "cold") {
    return (
      <span
        className="liquid-glass liquid-glass-pill relative inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs text-fog"
        data-affinity-cold
      >
        <span className="affinity-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        Califica {state.missing} {state.missing === 1 ? "vista" : "vistas"} más y te digo
      </span>
    );
  }

  const { affinity } = state;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${affinity.label}. Por qué`}
        className={cn("press-scale rounded-full", focusRing)}
        data-affinity-chip={affinity.level}
      >
        <AffinityChip
          level={affinity.level}
          label={affinity.label}
          lowConfidence={affinity.lowConfidence}
          variant="ficha"
        />
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={headingId}
        overlayLabel="Cerrar Por qué"
        align="bottom"
        dragDismiss
        portal
      >
        <div className="flex flex-col items-center px-5 pt-3">
          <SheetHandle />
          <div className="w-full">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-affinity">Para ti</p>
            <h2 id={headingId} className="mt-1 font-serif text-2xl leading-tight text-paper">
              ¿Por qué «{affinity.label}»?
            </h2>
            <p className="mt-1 line-clamp-1 text-[13px] text-fog">{titleName}</p>
          </div>
        </div>

        <div className="px-5 pt-4" data-no-sheet-drag>
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3.5 py-3">
            <AffinityChip level={affinity.level} label={affinity.label} variant="ficha" />
            <p className="text-[13px] leading-snug text-fog">{affinity.meaning}</p>
          </div>
        </div>

        {affinity.reasons.length > 0 ? (
          <ul className="space-y-4 px-5 pt-5" data-no-sheet-drag>
            {affinity.reasons.map((reason, index) => (
              <li key={`${reason.text}-${index}`} className="flex items-start gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-affinity/12 text-affinity">
                  <SparkIcon />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-snug text-paper">{reason.text}</p>
                  {reason.detail ? (
                    <p className="mt-0.5 text-[13px] leading-snug text-fog">{reason.detail}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="px-5 pb-2 pt-6 text-center text-xs leading-relaxed text-faint" data-no-sheet-drag>
          {affinity.lowConfidence
            ? "Tómalo como una pista: tienes pocas notas o casi no has visto películas así. "
            : ""}
          Sale de tus notas, Favoritas y listas, comparadas con lo que te ha gustado. No es una predicción de tu nota.
        </p>
      </Sheet>
    </>
  );
};

const SparkIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5Z" />
    <path d="M5 15.5c.3 1.8 1.2 2.7 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.3 2.7-1.2 3-3Z" />
  </svg>
);
