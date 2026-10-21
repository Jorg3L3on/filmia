"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export type ChapterBarLens = {
  slug: string;
  name: string;
  /** Cards in this chapter. */
  count: number;
};

type ChapterBarProps = {
  lenses: readonly ChapterBarLens[];
  activeSlug: string;
  /** 0-based position of the hero inside its chapter. */
  positionInLens: number;
  /** Cards still to come in the whole night, after the hero. */
  remaining: number;
  onSelect: (slug: string) => void;
  className?: string;
};

/** Beyond this many chapters the segments stop scaling with their cards and share the width. */
const EQUALIZE_FROM = 7;

/**
 * Chapters and progress under the lens rail (FIL-I21-3): one 2 px segment per lens, scaled to
 * its cards (equal from seven lenses on), the current one filling as the hero advances, and
 * «quedan N» for the whole night. Each segment is a 44 px-tall button that jumps to its lens,
 * like the rail. The fill moves with transform only; the colours switch by opacity.
 */
export const ChapterBar = ({
  lenses,
  activeSlug,
  positionInLens,
  remaining,
  onSelect,
  className,
}: ChapterBarProps) => {
  const activeIndex = Math.max(
    0,
    lenses.findIndex((lens) => lens.slug === activeSlug),
  );
  const active = lenses[activeIndex];
  const count = Math.max(1, active?.count ?? 1);
  const position = Math.min(count - 1, Math.max(0, positionInLens));
  const fill = (position + 1) / count;
  const onLastOfLens = position === count - 1 && activeIndex < lenses.length - 1;
  const equalize = lenses.length >= EQUALIZE_FROM;
  // The next segment breathes once when the hero reaches its chapter's last card.
  const [breathKey, setBreathKey] = useState<string | null>(null);
  const lastBreath = useRef<string | null>(null);
  useEffect(() => {
    const key = onLastOfLens ? `${activeSlug}:${position}` : null;
    if (key && key !== lastBreath.current) {
      lastBreath.current = key;
      const timer = window.setTimeout(() => setBreathKey(key), 0);
      return () => window.clearTimeout(timer);
    }
  }, [activeSlug, onLastOfLens, position]);

  if (lenses.length === 0 || !active) {
    return null;
  }

  const valueText = `${active.name}, carta ${position + 1} de ${count}; quedan ${remaining} esta noche`;

  return (
    <div className={cn("chapter-bar", className)}>
      <div
        role="progressbar"
        aria-label="Capítulos de la noche"
        aria-valuemin={0}
        aria-valuemax={count}
        aria-valuenow={position + 1}
        aria-valuetext={valueText}
        className="chapter-bar-track"
      >
        {lenses.map((lens, index) => {
          const state = index < activeIndex ? "past" : index === activeIndex ? "current" : "ahead";
          const breathing = breathKey != null && index === activeIndex + 1 && onLastOfLens;
          return (
            <button
              key={lens.slug}
              type="button"
              tabIndex={-1}
              aria-label={`Ir a ${lens.name}, ${lens.count} ${lens.count === 1 ? "carta" : "cartas"}`}
              onClick={() => onSelect(lens.slug)}
              onPointerDown={(event) => event.stopPropagation()}
              style={{ flexGrow: equalize ? 1 : Math.max(1, lens.count) }}
              className={cn(
                "chapter-bar-segment",
                `is-${state}`,
                breathing && "is-breathing",
                focusRing,
              )}
              data-state={state}
            >
              <span className="chapter-bar-rail" aria-hidden="true">
                <span
                  className="chapter-bar-fill"
                  style={{ transform: `scaleX(${state === "current" ? fill : state === "past" ? 1 : 0})` }}
                />
              </span>
            </button>
          );
        })}
      </div>
      <span className="chapter-bar-remaining" aria-hidden="true">
        quedan {remaining}
      </span>
    </div>
  );
};
