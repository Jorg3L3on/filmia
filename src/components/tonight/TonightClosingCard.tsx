"use client";

import Link from "next/link";
import type { ChapterBarLens } from "@/components/tonight/ChapterBar";
import { cn } from "@/lib/cn";
import { closingCopy, type ClosingStats } from "@/lib/tonight/closing-card";
import { focusRing } from "@/lib/ui";

type ClosingCardContentProps = {
  stats: ClosingStats;
  lenses: readonly ChapterBarLens[];
  /** «Volver al principio»: the long jump to card 0. Absent in the empty state. */
  onRestart?: () => void;
  /** Keyboard reach: only the hero's controls are tabbable inside the deck. */
  tabbable?: boolean;
  /** «Por hoy, listo»: the same card, centred in the sala, when nothing is left to deal. */
  empty?: boolean;
};

/**
 * What the closing card says (FIL-I21-6): the eyebrow, «Eso es todo por hoy», the night's
 * counters, the chapter bar full, and the way out. Shared by the deck's last card and the
 * empty state.
 */
export const ClosingCardContent = ({ stats, lenses, onRestart, tabbable = true, empty = false }: ClosingCardContentProps) => {
  const copy = closingCopy(stats);
  const tabIndex = tabbable ? 0 : -1;
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();
  return (
    <div className="closing-card-content">
      <p className="closing-card-eyebrow">{empty ? "Hoy" : "Esta noche"}</p>
      <h2 className="closing-card-title font-serif">{empty ? "Por hoy, listo" : "Eso es todo por hoy"}</h2>
      {empty ? (
        <p className="closing-card-counters">Ya no queda nada en el mazo de hoy. Añade títulos a Quiero ver o vuelve mañana.</p>
      ) : (
        <>
          {copy.headline ? <p className="closing-card-counters is-headline">{copy.headline}</p> : null}
          <p className="closing-card-counters">{copy.counters}</p>
        </>
      )}
      {lenses.length > 0 ? (
        <div className="closing-card-bar" aria-hidden="true">
          {lenses.map((lens) => (
            <span key={lens.slug} style={{ flexGrow: lenses.length >= 7 ? 1 : Math.max(1, lens.count) }} />
          ))}
        </div>
      ) : null}
      <div className="closing-card-actions">
        {onRestart ? (
          <button
            type="button"
            tabIndex={tabIndex}
            onPointerDown={stop}
            onClick={(event) => {
              event.stopPropagation();
              onRestart();
            }}
            className={cn("closing-card-primary press-scale", focusRing)}
          >
            Volver al principio
          </button>
        ) : null}
        <Link
          href="/watchlist"
          tabIndex={tabIndex}
          onPointerDown={stop}
          onClick={stop}
          className={cn("closing-card-secondary press-scale", focusRing)}
        >
          Abrir Quiero ver
        </Link>
        <Link href="/buscar" tabIndex={tabIndex} onPointerDown={stop} onClick={stop} className={cn("closing-card-link", focusRing)}>
          Buscar
        </Link>
      </div>
    </div>
  );
};

/** «Por hoy, listo»: the closing card alone in the sala, in the neutral colour. */
export const TonightClosingEmpty = ({ lenses = [] }: { lenses?: readonly ChapterBarLens[] }) => (
  <div className="closing-card-empty">
    <div className="closing-card-face is-standalone">
      <ClosingCardContent stats={{ total: 0, watched: 0, notTonight: 0 }} lenses={lenses} empty />
    </div>
  </div>
);
