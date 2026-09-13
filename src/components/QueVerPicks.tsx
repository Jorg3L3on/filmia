"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CoverflowDeck } from "@/components/CoverflowDeck";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { DiaryGenreToggle } from "@/components/DiaryGenreToggle";
import {
  categoryHref,
  coverflowStartIndex,
  resolveCategoryNeighbor,
} from "@/lib/diary-category-continuum";
import type { DiaryCategory } from "@/lib/diary-picks";
import { cn } from "@/lib/cn";

export type QueVerCategoryDeck = {
  category: DiaryCategory;
  titles: CoverflowTitle[];
};

type QueVerPicksProps = {
  decks: QueVerCategoryDeck[];
  initialSlug: string;
};

export const QueVerPicks = ({ decks, initialSlug }: QueVerPicksProps) => {
  const router = useRouter();
  const categories = useMemo(
    () => decks.map((deck) => deck.category),
    [decks],
  );
  const [activeSlug, setActiveSlug] = useState(initialSlug);
  const [startIndex, setStartIndex] = useState(0);
  const [transitionClass, setTransitionClass] = useState<string | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const transitionTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (transitionTimer.current != null) {
        window.clearTimeout(transitionTimer.current);
      }
    },
    [],
  );

  const activeDeck =
    decks.find((deck) => deck.category.slug === activeSlug) ?? decks[0];

  const announce = (name: string) => {
    const node = liveRef.current;
    if (!node) {
      return;
    }
    node.textContent = `Categoría ${name}`;
  };

  const playTransition = (direction: "prev" | "next") => {
    if (transitionTimer.current != null) {
      window.clearTimeout(transitionTimer.current);
    }
    setTransitionClass(
      direction === "next" ? "que-ver-deck-slide-next" : "que-ver-deck-slide-prev",
    );
    transitionTimer.current = window.setTimeout(() => {
      setTransitionClass(null);
      transitionTimer.current = null;
    }, 320);
  };

  const goToCategory = useCallback(
    (slug: string, start: "first" | "last", direction?: "prev" | "next") => {
      const deck = decks.find((item) => item.category.slug === slug);
      if (!deck) {
        return;
      }
      if (direction) {
        playTransition(direction);
      }
      setActiveSlug(slug);
      setStartIndex(coverflowStartIndex(deck.titles.length, start));
      announce(deck.category.name);
      router.replace(categoryHref(slug), { scroll: false });
    },
    [decks, router],
  );

  const handleEdgeNavigate = useCallback(
    (direction: "prev" | "next") => {
      const neighbor = resolveCategoryNeighbor(categories, activeSlug, direction);
      if (!neighbor) {
        return;
      }
      goToCategory(neighbor.slug, neighbor.startIndex, direction);
    },
    [activeSlug, categories, goToCategory],
  );

  if (!activeDeck || activeDeck.titles.length === 0) {
    return null;
  }

  return (
    <div className="diario-que-ver-body flex min-h-0 flex-1 flex-col gap-1.5 sm:gap-3">
      <div className="shrink-0">
        <DiaryGenreToggle
          categories={categories}
          activeSlug={activeDeck.category.slug}
          onSelect={(slug) => goToCategory(slug, "first")}
        />
      </div>
      <div
        ref={liveRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          transitionClass,
        )}
      >
        <CoverflowDeck
          key={`${activeDeck.category.slug}-${startIndex}-${activeDeck.titles[0]?.id ?? "empty"}`}
          titles={activeDeck.titles}
          footer="watched"
          className="min-h-0 flex-1"
          initialIndex={startIndex}
          onEdgeNavigate={handleEdgeNavigate}
        />
      </div>
    </div>
  );
};
