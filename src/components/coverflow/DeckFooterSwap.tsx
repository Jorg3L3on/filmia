"use client";

import { useEffect, useState } from "react";
import { DeckFooter, type DeckFooterProps } from "@/components/coverflow/DeckFooter";
import type { CoverflowTitle } from "@/components/coverflow/types";

/** Matches `.deck-footer-swap-out` (`--duration-exit`) plus slack. */
const FOOTER_LEAVE_MS = 280;

type DeckFooterSwapProps = DeckFooterProps & {
  /** Cinematic decks crossfade; the page / sheet decks render the footer as is. */
  crossfade: boolean;
};

/**
 * Crossfades the cinematic footer between titles: the outgoing footer fades out over the
 * incoming one instead of vanishing. The outgoing copy keeps the title object it had, so a
 * card that just left the deck (marked seen) can still fade out. It is inert while it goes.
 */
export const DeckFooterSwap = ({ crossfade, ...props }: DeckFooterSwapProps) => {
  const title = props.activeTitle;
  const [lastTitle, setLastTitle] = useState(title);
  const [leaving, setLeaving] = useState<{ seq: number; title: CoverflowTitle } | null>(null);

  if (title !== lastTitle) {
    if (crossfade && title.id !== lastTitle.id) {
      setLeaving((prev) => ({ seq: (prev?.seq ?? 0) + 1, title: lastTitle }));
    }
    setLastTitle(title);
  }

  const leavingSeq = leaving?.seq ?? null;
  useEffect(() => {
    if (leavingSeq == null) {
      return;
    }
    const timer = window.setTimeout(() => setLeaving(null), FOOTER_LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [leavingSeq]);

  if (!crossfade) {
    return <DeckFooter {...props} />;
  }

  return (
    <div className="deck-footer-swap">
      <div key={title.id} className="deck-footer-swap-in">
        <DeckFooter {...props} />
      </div>
      {leaving ? (
        <div key={`out-${leaving.seq}`} className="deck-footer-swap-out" aria-hidden inert>
          <DeckFooter {...props} activeTitle={leaving.title} />
        </div>
      ) : null}
    </div>
  );
};
