"use client";

import { useEffect, useRef } from "react";
import { DeckCard } from "@/components/coverflow/DeckCard";
import { DeckFooter } from "@/components/coverflow/DeckFooter";
import { CoverflowIndicators } from "@/components/coverflow/CoverflowIndicators";
import { useCoverflowEngine } from "@/components/coverflow/useCoverflowEngine";
import { useCoverflowLocalTitles } from "@/components/coverflow/useCoverflowLocalTitles";
import type { CoverflowDeckProps, CoverflowTitle } from "@/components/coverflow/types";
import { cn } from "@/lib/cn";
import { COVERFLOW_VISIBLE_SPAN } from "@/lib/coverflow-metrics";
import { useSpringFeedback } from "@/lib/motion";

export type { CoverflowTitle };

export const CoverflowDeck = ({
  titles: incomingTitles,
  className,
  listId,
  variant = "page",
  onActiveChange,
  footer = "full",
}: CoverflowDeckProps) => {
  const {
    titles,
    handleHide,
    handleRestore,
    handleMarkedSeen,
    handleMarkSeenError,
  } = useCoverflowLocalTitles(incomingTitles);
  const isSheet = variant === "sheet";
  const focusSpring = useSpringFeedback();
  const notifiedIndex = useRef<number | null>(null);
  const engine = useCoverflowEngine(titles.length, isSheet);
  const {
    containerRef,
    stageRef,
    activeIndex,
    cardWidth,
    stageWidth,
    registerNode,
    handleSelectCard,
    handlePointerDown,
    handleKeyDown,
    handleClickCapture,
  } = engine;

  useEffect(() => {
    if (titles.length === 0) {
      notifiedIndex.current = null;
      return;
    }

    const title = titles[activeIndex];
    if (!title || notifiedIndex.current === activeIndex) {
      return;
    }

    const isFirst = notifiedIndex.current == null;
    notifiedIndex.current = activeIndex;
    onActiveChange?.(activeIndex, title);
    if (isSheet && !isFirst) {
      focusSpring.trigger();
    }
  }, [activeIndex, focusSpring, isSheet, onActiveChange, titles]);

  if (titles.length === 0) {
    return null;
  }

  const activeTitle = titles[activeIndex];
  if (!activeTitle) {
    return null;
  }
  const showMarkSeenEye = footer === "watched" && !isSheet;
  const visibleSpan = stageWidth < 500 ? 4 : COVERFLOW_VISIBLE_SPAN;
  const firstVisible = Math.max(0, activeIndex - visibleSpan);
  const lastVisible = Math.min(titles.length - 1, activeIndex + visibleSpan);
  const visibleTitles = titles.slice(firstVisible, lastVisible + 1);

  return (
    <div className={cn("min-w-0", isSheet ? "space-y-4" : "space-y-6", className)}>
      <div
        ref={containerRef}
        role="listbox"
        aria-label="Mazo de títulos"
        aria-activedescendant={`coverflow-item-${activeTitle.id}`}
        data-no-sheet-drag={isSheet ? "" : undefined}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onClickCapture={handleClickCapture}
        className={cn(
          "relative min-w-0 cursor-grab touch-none select-none overscroll-none outline-none",
          isSheet
            ? "overflow-visible bg-transparent px-0 pb-2 pt-1 focus-visible:ring-2 focus-visible:ring-accent/60"
            : "overflow-hidden rounded-md border border-line bg-gradient-to-b from-canvas-deep via-canvas to-[#0a0d10] px-1 pb-9 pt-4 focus-visible:ring-2 focus-visible:ring-accent/60 sm:px-8 sm:pb-14 sm:pt-14",
        )}
      >
        <div
          ref={stageRef}
          className="relative mx-auto w-full"
          style={{
            height: cardWidth * 1.5,
            perspective: "1200px",
            perspectiveOrigin: "50% 48%",
          }}
        >
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: cardWidth,
              height: cardWidth * 1.5,
              marginLeft: -cardWidth / 2,
              marginTop: -(cardWidth * 1.5) / 2,
              transformStyle: "preserve-3d",
              contain: "layout style",
            }}
          >
            {visibleTitles.map((title, visibleIndex) => {
              const index = firstVisible + visibleIndex;
              return (
                <DeckCard
                  key={title.id}
                  title={title}
                  index={index}
                  compact={isSheet}
                  nearFocus={Math.abs(index - activeIndex) <= 1}
                  showMarkSeenEye={showMarkSeenEye}
                  onSelect={handleSelectCard}
                  onPointerDown={handlePointerDown}
                  registerNode={registerNode}
                  onMarkedSeen={handleMarkedSeen}
                  onMarkSeenError={handleMarkSeenError}
                />
              );
            })}
          </div>
        </div>

        {isSheet ? null : (
          <CoverflowIndicators titles={titles} activeIndex={activeIndex} />
        )}
      </div>

      {activeTitle ? (
        <DeckFooter
          activeTitle={activeTitle}
          isSheet={isSheet}
          footer={footer}
          listId={listId}
          focusClassName={focusSpring.className}
          onHide={handleHide}
          onRestore={handleRestore}
          onMarkedSeen={handleMarkedSeen}
        />
      ) : null}
    </div>
  );
};
