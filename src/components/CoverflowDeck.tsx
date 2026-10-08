"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DeckCard } from "@/components/coverflow/DeckCard";
import { DeckFooter } from "@/components/coverflow/DeckFooter";
import { CoverflowIndicators } from "@/components/coverflow/CoverflowIndicators";
import { QueVerAtmosphere } from "@/components/coverflow/QueVerAtmosphere";
import { useCoverflowEngine } from "@/components/coverflow/useCoverflowEngine";
import { useCoverflowLocalTitles } from "@/components/coverflow/useCoverflowLocalTitles";
import { useListCardMenu } from "@/components/coverflow/useListCardMenu";
import { useAmbientGrade, usePosterAmbientColor } from "@/components/coverflow/usePosterAmbientColor";
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
  initialIndex = 0,
  focusRequest,
}: CoverflowDeckProps) => {
  const {
    titles,
    handleHide,
    handleRestore,
    handleMarkedSeen,
    handleMarkSeenError,
  } = useCoverflowLocalTitles(incomingTitles);
  const isSheet = variant === "sheet";
  const cinematic =
    (footer === "watched" || footer === "tonight" || footer === "list") && !isSheet;
  const chipsInFooter = footer === "tonight" || footer === "list";
  const focusSpring = useSpringFeedback();
  // By title, not index: removing the hero slides the next card into the same index.
  const notifiedId = useRef<string | null>(null);
  const deckRootRef = useRef<HTMLDivElement>(null);
  const [lightLeakKey, setLightLeakKey] = useState(0);
  const cardMenu = useListCardMenu({
    listId,
    enabled: footer === "list" && !isSheet,
    onHide: handleHide,
    onRestore: handleRestore,
  });
  const engine = useCoverflowEngine(titles.length, isSheet, cinematic, { initialIndex });
  const {
    containerRef,
    stageRef,
    activeIndex,
    cardWidth,
    stageWidth,
    registerNode,
    handleSelectCard,
    jumpTo,
    handlePointerDown,
    handleKeyDown,
    handleClickCapture,
  } = engine;

  // Each new `seq` moves the deck once (identity changes alone must not re-jump).
  const appliedFocusSeq = useRef(focusRequest?.seq);
  useEffect(() => {
    if (!focusRequest || focusRequest.seq === appliedFocusSeq.current) {
      return;
    }
    appliedFocusSeq.current = focusRequest.seq;
    jumpTo(focusRequest.index);
  }, [focusRequest, jumpTo]);

  const activeTitle = titles[activeIndex] ?? titles[0];
  const ambient = usePosterAmbientColor(
    cinematic ? activeTitle?.posterPath : null,
    activeTitle?.tonight?.posterAmbient ?? null,
  );

  const nextTitle =
    cinematic && activeIndex < titles.length - 1
      ? titles[activeIndex + 1]
      : null;
  const ghostPosterPath = cinematic ? (nextTitle?.posterPath ?? null) : null;
  // Soft always-on ghost; stronger near the trailing edge (continuum hint).
  const nearTrailingEdge =
    cinematic && titles.length > 1 && activeIndex >= titles.length - 2;
  const ghostOpacity = !ghostPosterPath
    ? 0
    : nearTrailingEdge
      ? 0.48
      : 0.28;

  const handleSlideCommit = useCallback(() => {
    if (!cinematic) {
      return;
    }
    setLightLeakKey((value) => value + 1);
  }, [cinematic]);

  useAmbientGrade(deckRootRef, ambient.cssRgb, cinematic);

  useEffect(() => {
    if (titles.length === 0) {
      notifiedId.current = null;
      return;
    }

    const title = titles[activeIndex];
    if (!title || notifiedId.current === title.id) {
      return;
    }

    const isFirst = notifiedId.current == null;
    notifiedId.current = title.id;
    onActiveChange?.(activeIndex, title);
    if (isSheet && !isFirst) {
      focusSpring.trigger();
    }
  }, [activeIndex, focusSpring, isSheet, onActiveChange, titles]);

  if (!activeTitle) {
    return null;
  }
  // Slide is the primary CTA in soft-coverflow; poster eye fights the floating look.
  const showMarkSeenEye = false;
  const visibleSpan = stageWidth < 500 ? 4 : COVERFLOW_VISIBLE_SPAN;
  const firstVisible = Math.max(0, activeIndex - visibleSpan);
  const lastVisible = Math.min(titles.length - 1, activeIndex + visibleSpan);
  const visibleTitles = titles.slice(firstVisible, lastVisible + 1);
  const stageHeightPx = cinematic ? undefined : cardWidth * 1.5;

  return (
    <div
      ref={deckRootRef}
      className={cn(
        "min-w-0",
        isSheet
          ? "space-y-4"
          : cinematic
            ? "diario-que-ver-deck flex min-h-0 flex-1 flex-col gap-2 sm:gap-3"
            : "space-y-6",
        className,
      )}
      style={cinematic ? ambient.style : undefined}
    >
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
            : cinematic
              ? "coverflow-cinematic flex min-h-0 flex-1 flex-col overflow-visible border-0 bg-transparent px-0 py-0 outline-none ring-0"
              : "overflow-hidden px-1 pb-[4.5rem] pt-4 focus-visible:ring-2 focus-visible:ring-accent/60 sm:px-8 sm:pb-24 sm:pt-14",
        )}
      >
        <div
          ref={stageRef}
          className={cn(
            "relative mx-auto w-full",
            cinematic && "coverflow-cinematic-stage",
          )}
          style={{
            height: stageHeightPx,
            perspective: cinematic ? "1400px" : "1200px",
            perspectiveOrigin: "50% 45%",
          }}
        >
          {cinematic ? (
            <QueVerAtmosphere
              glowRgb={ambient.cssRgb}
              ghostPosterPath={ghostPosterPath}
              ghostOpacity={ghostOpacity}
              lightLeakKey={lightLeakKey}
            />
          ) : null}
          {cinematic ? (
            <div className="coverflow-soft-glow" aria-hidden />
          ) : null}
          <div
            className="absolute left-1/2 top-1/2 z-[1]"
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
                  cinematic={cinematic}
                  nearFocus={Math.abs(index - activeIndex) <= 1}
                  showMarkSeenEye={showMarkSeenEye}
                  onSelect={handleSelectCard}
                  onPointerDown={handlePointerDown}
                  registerNode={registerNode}
                  onMarkedSeen={handleMarkedSeen}
                  onMarkSeenError={handleMarkSeenError}
                  onStubCommit={chipsInFooter ? handleSlideCommit : undefined}
                  onOpenMenu={cardMenu.openMenu}
                  chipsInFooter={chipsInFooter}
                />
              );
            })}
          </div>
        </div>

        {isSheet || cinematic ? null : (
          <CoverflowIndicators titles={titles} activeIndex={activeIndex} />
        )}
      </div>

      {activeTitle ? (
        <div className={cinematic ? "shrink-0" : undefined}>
          <DeckFooter
            activeTitle={activeTitle}
            isSheet={isSheet}
            footer={footer}
            focusClassName={focusSpring.className}
            onOpenMenu={cardMenu.openMenu}
            onSlideCommit={cinematic ? handleSlideCommit : undefined}
          />
        </div>
      ) : null}

      {cardMenu.menu}
    </div>
  );
};
