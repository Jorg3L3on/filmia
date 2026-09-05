"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { removeTitleFromList } from "@/app/actions/lists";
import { MarkWatchedForm } from "@/components/MarkWatchedForm";
import { PosterImage } from "@/components/PosterImage";
import { SharedPoster } from "@/components/SharedPoster";
import { SeriesStatusBadge } from "@/components/SeriesStatusBadge";
import { WatchedBadge } from "@/components/WatchedBadge";
import { WatchProviderChips } from "@/components/WatchProvidersMx";
import { cn } from "@/lib/cn";
import {
  formatImdbRating,
  formatRating,
  formatSeriesSeason,
  PLATFORM_LABEL,
  SERIES_STATUS_LABEL,
  TITLE_KIND_LABEL,
} from "@/lib/labels";
import { useSpringFeedback } from "@/lib/motion";
import { btnGhost, btnLink } from "@/lib/ui";
import type { Platform, SeriesStatus, TitleKind } from "@/generated/prisma/browser";
import type { WatchProviderOffer } from "@/lib/watch-providers";

export type CoverflowTitle = {
  id: string;
  name: string;
  kind: TitleKind;
  year: number | null;
  rating: number | null;
  posterPath: string | null;
  platform: Platform | null;
  imdbRating: number | null;
  watched?: boolean;
  review?: string | null;
  seriesStatus?: SeriesStatus | null;
  seriesSeason?: number | null;
  flatrateProviders?: WatchProviderOffer[];
};

type CoverflowDeckProps = {
  titles: CoverflowTitle[];
  className?: string;
  listId?: string;
  variant?: "page" | "sheet";
  onActiveChange?: (index: number, title: CoverflowTitle) => void;
};

const CARD_WIDTH = 236;
const CARD_WIDTH_SHEET = 156;
const CARD_WIDTH_MIN = 128;
const CARD_WIDTH_SHEET_MIN = 112;
const DRAG_THRESHOLD = 6;
const WHEEL_SENSITIVITY = 0.0036;
const SNAP_LERP = 0.14;
const COAST_FRICTION = 0.94;
const COAST_MIN_VELOCITY = 0.0024;
const WHEEL_SNAP_MS = 90;
const VISIBLE_SPAN = 5;

type CardMetrics = {
  rotateY: number;
  translateX: number;
  translateZ: number;
  translateY: number;
  scale: number;
  brightness: number;
  opacity: number;
  zIndex: number;
  shadow: string;
  isActive: boolean;
};

const clampIndex = (value: number, max: number) =>
  Math.min(Math.max(value, 0), Math.max(max, 0));

const getCardMetrics = (
  offset: number,
  sideRoom: number,
  compact = false,
): CardMetrics => {
  const distance = Math.abs(offset);
  const side = Math.sign(offset) || 0;
  const isActive = distance < 0.45;
  const fittedRoom = Math.max(10, sideRoom);
  const spread = fittedRoom * (1 - Math.exp(-distance * (compact ? 0.86 : 0.72)));
  const rotateCap = compact ? 22 : fittedRoom < 90 ? 14 : 26;

  return {
    rotateY: -side * Math.min(distance * (compact ? 11 : 7.5), rotateCap),
    translateX: side * spread,
    translateZ: -Math.min(distance * (compact ? 22 : 14), compact ? 64 : 48),
    translateY: isActive ? -6 : Math.min(distance * (compact ? 6 : 3), compact ? 16 : 10),
    scale: 1 - Math.min(distance * (compact ? 0.12 : 0.015), compact ? 0.28 : 0.05),
    brightness: Math.max(compact ? 0.62 : 0.72, 1 - distance * (compact ? 0.14 : 0.08)),
    opacity: distance > 5.2 ? Math.max(0, 1 - (distance - 5.2) * 1.4) : 1,
    zIndex: Math.round(900 - distance * 80),
    shadow: isActive
      ? compact
        ? "0 18px 36px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(124, 156, 255, 0.7)"
        : "0 28px 50px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(124, 156, 255, 0.28)"
      : "0 14px 28px rgba(0, 0, 0, 0.38)",
    isActive,
  };
};

type DeckCardProps = {
  title: CoverflowTitle;
  index: number;
  offset: number;
  sideRoom: number;
  isDragging: boolean;
  compact?: boolean;
  onSelect: (index: number) => void;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
};

const DeckCard = ({
  title,
  index,
  offset,
  sideRoom,
  isDragging,
  compact = false,
  onSelect,
  onPointerDown,
}: DeckCardProps) => {
  const metrics = getCardMetrics(offset, sideRoom, compact);
  const imdbLabel = formatImdbRating(title.imdbRating);
  const showCaption = !compact && Math.abs(offset) < 3.2;

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (metrics.isActive) {
      return;
    }

    event.preventDefault();
    onSelect(index);
  };

  const handleDragStart = (event: React.DragEvent<HTMLAnchorElement>) => {
    event.preventDefault();
  };

  return (
    <article
      id={`coverflow-item-${title.id}`}
      role="option"
      aria-selected={metrics.isActive}
      aria-hidden={metrics.opacity < 0.08}
      className={cn(
        "absolute inset-0 origin-center",
        metrics.opacity < 0.08 ? "pointer-events-none" : "pointer-events-auto",
      )}
      style={{
        transform: `translate3d(${metrics.translateX}px, ${metrics.translateY}px, ${metrics.translateZ}px) rotateY(${metrics.rotateY}deg) scale(${metrics.scale})`,
        filter: `brightness(${metrics.brightness})`,
        opacity: metrics.opacity,
        zIndex: metrics.zIndex,
        transition: "filter 220ms ease, opacity 220ms ease, box-shadow 220ms ease",
        boxShadow: metrics.shadow,
        backfaceVisibility: "hidden",
        willChange: "transform",
      }}
      onPointerDown={onPointerDown}
    >
      <Link
        href={`/titulos/${title.id}`}
        tabIndex={metrics.isActive ? 0 : -1}
        aria-label={`${title.name}${title.year ? ` (${title.year})` : ""}`}
        onClick={handleClick}
        onDragStart={handleDragStart}
        className={cn(
          "relative block h-full overflow-hidden rounded-poster border bg-surface [&_img]:pointer-events-none",
          isDragging ? "cursor-grabbing" : "cursor-grab",
          metrics.isActive
            ? compact
              ? "border-accent"
              : "border-accent/40"
            : "border-white/10",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
        draggable={false}
      >
        {compact ? (
          <PosterImage
            name={title.name}
            posterPath={title.posterPath}
            priority={metrics.isActive}
            className="absolute inset-0 h-full w-full rounded-none [aspect-ratio:auto]"
          />
        ) : (
          <SharedPoster titleId={title.id} className="absolute inset-0">
            <PosterImage
              name={title.name}
              posterPath={title.posterPath}
              priority={metrics.isActive}
              className="absolute inset-0 h-full w-full rounded-none [aspect-ratio:auto]"
            />
          </SharedPoster>
        )}
        {!compact && title.watched ? (
          <WatchedBadge compact className="absolute left-2 top-2 z-10" />
        ) : null}
        {!compact && title.kind === "SERIES" && title.seriesStatus ? (
          <SeriesStatusBadge
            status={title.seriesStatus}
            compact
            className="absolute right-2 top-2 z-10"
          />
        ) : null}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-3 pt-10",
            showCaption ? "opacity-100" : "opacity-0",
          )}
        >
          <p className="truncate text-[10px] uppercase tracking-wider text-white/70">
            {TITLE_KIND_LABEL[title.kind]}
            {title.year ? ` · ${title.year}` : ""}
          </p>
          <p className="truncate font-serif text-sm leading-tight text-white">
            {title.name}
          </p>
          <p className="truncate text-xs text-star">
            {formatRating(title.rating)}
            {imdbLabel ? ` · ${imdbLabel}` : ""}
          </p>
        </div>
      </Link>
    </article>
  );
};

export const CoverflowDeck = ({
  titles,
  className,
  listId,
  variant = "page",
  onActiveChange,
}: CoverflowDeckProps) => {
  const isSheet = variant === "sheet";
  const focusSpring = useSpringFeedback();
  const notifiedIndex = useRef<number | null>(null);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [cardWidth, setCardWidth] = useState(isSheet ? CARD_WIDTH_SHEET : CARD_WIDTH);
  const [stageWidth, setStageWidth] = useState(480);
  const dragStartX = useRef(0);
  const dragStartIndex = useRef(0);
  const targetIndexRef = useRef(0);
  const displayIndexRef = useRef(0);
  const velocityRef = useRef(0);
  const prevPointerX = useRef(0);
  const prevPointerTime = useRef(0);
  const isDraggingRef = useRef(false);
  const motionModeRef = useRef<"idle" | "drag" | "coast">("idle");
  const suppressClick = useRef(false);
  const titlesLengthRef = useRef(titles.length);
  const cardWidthRef = useRef(CARD_WIDTH);
  const rafRef = useRef<number | null>(null);
  const wheelSnapTimeout = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  displayIndexRef.current = displayIndex;
  titlesLengthRef.current = titles.length;
  cardWidthRef.current = cardWidth;

  const maxIndex = () => Math.max(titlesLengthRef.current - 1, 0);

  const stopRaf = () => {
    if (rafRef.current == null) {
      return;
    }

    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const tick = useCallback(() => {
    const ceiling = maxIndex();
    const mode = motionModeRef.current;

    if (mode === "drag") {
      displayIndexRef.current = targetIndexRef.current;
      rafRef.current = null;
      setDisplayIndex(displayIndexRef.current);
      return;
    }

    if (mode === "coast") {
      displayIndexRef.current = clampIndex(
        displayIndexRef.current + velocityRef.current,
        ceiling,
      );
      velocityRef.current *= COAST_FRICTION;

      const atEdge =
        (displayIndexRef.current <= 0 && velocityRef.current < 0) ||
        (displayIndexRef.current >= ceiling && velocityRef.current > 0);

      if (atEdge || Math.abs(velocityRef.current) < COAST_MIN_VELOCITY) {
        motionModeRef.current = "idle";
        targetIndexRef.current = clampIndex(Math.round(displayIndexRef.current), ceiling);
        velocityRef.current = 0;
      } else {
        targetIndexRef.current = displayIndexRef.current;
      }
    }

    if (motionModeRef.current === "idle") {
      const gap = targetIndexRef.current - displayIndexRef.current;
      if (Math.abs(gap) < 0.001) {
        displayIndexRef.current = targetIndexRef.current;
        setDisplayIndex(displayIndexRef.current);
        rafRef.current = null;
        return;
      }

      displayIndexRef.current += gap * SNAP_LERP;
    }

    setDisplayIndex(displayIndexRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const ensureTick = useCallback(() => {
    if (rafRef.current != null) {
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const snapTo = useCallback(
    (index: number) => {
      motionModeRef.current = "idle";
      velocityRef.current = 0;
      targetIndexRef.current = clampIndex(index, titles.length - 1);
      ensureTick();
    },
    [ensureTick, titles.length],
  );

  const handleSelectCard = useCallback(
    (index: number) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }

      snapTo(index);
    },
    [snapTo],
  );

  const stopDragging = useCallback(() => {
    if (!isDraggingRef.current) {
      return;
    }

    isDraggingRef.current = false;
    setIsDragging(false);

    const projected = displayIndexRef.current + velocityRef.current * 12;
    const nearest = clampIndex(Math.round(projected), maxIndex());

    if (Math.abs(velocityRef.current) > COAST_MIN_VELOCITY * 3) {
      motionModeRef.current = "coast";
    } else {
      motionModeRef.current = "idle";
      targetIndexRef.current = nearest;
    }

    ensureTick();
  }, [ensureTick]);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (titlesLengthRef.current <= 1 || event.button !== 0) {
      return;
    }

    if (wheelSnapTimeout.current != null) {
      window.clearTimeout(wheelSnapTimeout.current);
      wheelSnapTimeout.current = null;
    }

    isDraggingRef.current = true;
    motionModeRef.current = "drag";
    suppressClick.current = false;
    dragStartX.current = event.clientX;
    dragStartIndex.current = displayIndexRef.current;
    prevPointerX.current = event.clientX;
    prevPointerTime.current = performance.now();
    velocityRef.current = 0;
    setIsDragging(true);
    stopRaf();
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isDraggingRef.current) {
        return;
      }

      const now = performance.now();
      const dt = Math.max(8, now - prevPointerTime.current);
      const dx = event.clientX - prevPointerX.current;
      const cardSpan = cardWidthRef.current * 0.58;
      const instantVelocity = -dx / cardSpan * (16.67 / dt);

      velocityRef.current = velocityRef.current * 0.72 + instantVelocity * 0.28;
      prevPointerX.current = event.clientX;
      prevPointerTime.current = now;

      const delta = event.clientX - dragStartX.current;
      if (Math.abs(delta) > DRAG_THRESHOLD) {
        suppressClick.current = true;
      }

      const next = clampIndex(dragStartIndex.current - delta / cardSpan, maxIndex());
      targetIndexRef.current = next;
      displayIndexRef.current = next;
      setDisplayIndex(next);
    };

    const handlePointerUp = () => {
      stopDragging();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [stopDragging]);

  useEffect(() => {
    return () => {
      stopRaf();
      if (wheelSnapTimeout.current != null) {
        window.clearTimeout(wheelSnapTimeout.current);
      }
    };
  }, []);

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    suppressClick.current = false;
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (titles.length <= 1) {
      return;
    }

    event.preventDefault();
    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

    motionModeRef.current = "idle";
    velocityRef.current = 0;
    targetIndexRef.current = clampIndex(
      targetIndexRef.current + delta * WHEEL_SENSITIVITY,
      titles.length - 1,
    );
    ensureTick();

    if (wheelSnapTimeout.current != null) {
      window.clearTimeout(wheelSnapTimeout.current);
    }

    wheelSnapTimeout.current = window.setTimeout(() => {
      targetIndexRef.current = clampIndex(
        Math.round(targetIndexRef.current),
        titles.length - 1,
      );
      ensureTick();
      wheelSnapTimeout.current = null;
    }, WHEEL_SNAP_MS);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      snapTo(Math.round(targetIndexRef.current) + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      snapTo(Math.round(targetIndexRef.current) - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      snapTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      snapTo(titles.length - 1);
    }
  };

  useEffect(() => {
    const ceiling = Math.max(titles.length - 1, 0);
    targetIndexRef.current = clampIndex(targetIndexRef.current, ceiling);
    displayIndexRef.current = clampIndex(displayIndexRef.current, ceiling);
    setDisplayIndex(displayIndexRef.current);
  }, [titles.length]);

  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) {
      return;
    }

    const measure = () => {
      const stage = node.clientWidth;
      const maxWidth = isSheet ? CARD_WIDTH_SHEET : CARD_WIDTH;
      const minWidth = isSheet ? CARD_WIDTH_SHEET_MIN : CARD_WIDTH_MIN;
      const nextCard = Math.round(
        Math.min(maxWidth, Math.max(minWidth, stage * (isSheet ? 0.36 : 0.46))),
      );
      setStageWidth(stage);
      setCardWidth(nextCard);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isSheet, titles.length]);

  useEffect(() => {
    if (titles.length === 0) {
      notifiedIndex.current = null;
      return;
    }

    const index = clampIndex(Math.round(displayIndex), titles.length - 1);
    const title = titles[index];
    if (!title || notifiedIndex.current === index) {
      return;
    }

    const isFirst = notifiedIndex.current == null;
    notifiedIndex.current = index;
    onActiveChange?.(index, title);
    if (isSheet && !isFirst) {
      focusSpring.trigger();
    }
  }, [displayIndex, focusSpring, isSheet, onActiveChange, titles]);

  if (titles.length === 0) {
    return null;
  }

  const roundedActive = Math.round(displayIndex);
  const activeTitle = titles[roundedActive];
  const sideRoom = Math.max(8, (stageWidth - cardWidth) / 2 - (isSheet ? 4 : 12));
  const visibleSpan = stageWidth < 500 ? 3 : VISIBLE_SPAN;
  const firstVisible = Math.max(0, Math.floor(displayIndex) - visibleSpan);
  const lastVisible = Math.min(titles.length - 1, Math.ceil(displayIndex) + visibleSpan);
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
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onClickCapture={handleClickCapture}
        className={cn(
          "relative min-w-0 cursor-grab touch-none select-none outline-none active:cursor-grabbing",
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
            }}
          >
            {visibleTitles.map((title, visibleIndex) => {
              const index = firstVisible + visibleIndex;
              return (
                <DeckCard
                  key={title.id}
                  title={title}
                  index={index}
                  offset={index - displayIndex}
                  sideRoom={sideRoom}
                  isDragging={isDragging}
                  compact={isSheet}
                  onSelect={handleSelectCard}
                  onPointerDown={handlePointerDown}
                />
              );
            })}
          </div>
        </div>

        {isSheet ? null : (
          <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {titles.map((title, index) => (
              <span
                key={title.id}
                className={cn(
                  "h-1.5 rounded-full transition",
                  index === roundedActive ? "w-4 bg-accent" : "w-1.5 bg-chrome",
                )}
              />
            ))}
          </div>
        )}
      </div>

      {activeTitle ? (
        <div
          className={cn(
            "mx-auto max-w-xl text-center",
            isSheet ? "space-y-1" : "space-y-3",
            isSheet && focusSpring.className,
          )}
        >
          <div className="space-y-1">
            {isSheet ? null : (
              <p className="text-xs uppercase tracking-[0.2em] text-accent">
                {roundedActive + 1} / {titles.length}
              </p>
            )}
            <h2
              className={cn(
                "font-serif text-white",
                isSheet ? "truncate px-6 text-xl" : "text-2xl sm:text-3xl",
              )}
            >
              <Link
                href={`/titulos/${activeTitle.id}`}
                className="hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {activeTitle.name}
              </Link>
            </h2>
            <p className={cn("text-fog", isSheet ? "text-xs" : "text-sm")}>
              {[
                activeTitle.year ? String(activeTitle.year) : null,
                TITLE_KIND_LABEL[activeTitle.kind],
                !isSheet && activeTitle.platform
                  ? PLATFORM_LABEL[activeTitle.platform]
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {isSheet ? null : (
              <>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {activeTitle.imdbRating != null ? (
                    <span className="rounded-full border border-chrome bg-well px-2.5 py-1 text-xs text-star">
                      ★ {formatImdbRating(activeTitle.imdbRating)}
                    </span>
                  ) : null}
                  {formatRating(activeTitle.rating) !== "Sin nota" ? (
                    <span className="rounded-full border border-chrome bg-well px-2.5 py-1 text-xs text-paper">
                      {formatRating(activeTitle.rating)}
                    </span>
                  ) : null}
                  <Link
                    href={`/titulos/${activeTitle.id}`}
                    className={cn(btnGhost, "text-xs")}
                  >
                    Ver ficha
                  </Link>
                </div>
                {activeTitle.kind === "SERIES" && activeTitle.seriesStatus ? (
                  <p className="text-sm text-fog">
                    {SERIES_STATUS_LABEL[activeTitle.seriesStatus]}
                    {formatSeriesSeason(activeTitle.seriesSeason)
                      ? ` · ${formatSeriesSeason(activeTitle.seriesSeason)}`
                      : ""}
                  </p>
                ) : null}
              </>
            )}
          </div>
          {isSheet ? null : (
            <>
              {activeTitle.flatrateProviders && activeTitle.flatrateProviders.length > 0 ? (
                <WatchProviderChips
                  providers={activeTitle.flatrateProviders}
                  max={5}
                  className="pt-1"
                />
              ) : null}
              {!activeTitle.watched ? (
                <div className="mx-auto max-w-md text-left">
                  <MarkWatchedForm
                    titleId={activeTitle.id}
                    variant="queue"
                    rating={activeTitle.rating}
                    review={activeTitle.review}
                    collapsed
                  />
                </div>
              ) : null}
              {listId ? (
                <form action={removeTitleFromList.bind(null, listId, activeTitle.id)}>
                  <button type="submit" className={btnLink}>
                    Quitar de la lista
                  </button>
                </form>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};
