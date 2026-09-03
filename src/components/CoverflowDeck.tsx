"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PosterImage } from "@/components/PosterImage";
import { WatchProviderChips } from "@/components/WatchProvidersMx";
import { cn } from "@/lib/cn";
import {
  formatImdbRating,
  formatRating,
  PLATFORM_LABEL,
  TITLE_KIND_LABEL,
} from "@/lib/labels";
import type { Platform, TitleKind } from "@/generated/prisma/client";
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
  flatrateProviders?: WatchProviderOffer[];
};

type CoverflowDeckProps = {
  titles: CoverflowTitle[];
  className?: string;
  footer?: (title: CoverflowTitle, index: number, isActive: boolean) => React.ReactNode;
};

const CARD_WIDTH = 236;
const CARD_WIDTH_MOBILE = 168;
const DRAG_THRESHOLD = 6;
const WHEEL_SENSITIVITY = 0.0036;
const SNAP_LERP = 0.14;
const COAST_FRICTION = 0.94;
const COAST_MIN_VELOCITY = 0.0024;
const WHEEL_SNAP_MS = 90;
const VISIBLE_BEFORE = 5;
const VISIBLE_AFTER = 5;

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

const getCardMetrics = (offset: number, cardWidth: number): CardMetrics => {
  const distance = Math.abs(offset);
  const side = Math.sign(offset) || 0;
  const isActive = distance < 0.45;
  const spread = (cardWidth * 0.7 * distance) / (1 + 0.16 * distance);

  return {
    rotateY: -side * Math.min(distance * 7.5, 26),
    translateX: side * spread,
    translateZ: -Math.min(distance * 18, 70),
    translateY: isActive ? -8 : Math.min(distance * 4, 14),
    scale: 1 - Math.min(distance * 0.015, 0.05),
    brightness: Math.max(0.72, 1 - distance * 0.08),
    opacity: distance > 5.2 ? Math.max(0, 1 - (distance - 5.2) * 1.4) : 1,
    zIndex: Math.round(900 - distance * 80),
    shadow: isActive
      ? "0 28px 50px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 224, 84, 0.22)"
      : "0 14px 28px rgba(0, 0, 0, 0.38)",
    isActive,
  };
};

type DeckCardProps = {
  title: CoverflowTitle;
  index: number;
  offset: number;
  cardWidth: number;
  isDragging: boolean;
  onSelect: (index: number) => void;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
};

const DeckCard = ({
  title,
  index,
  offset,
  cardWidth,
  isDragging,
  onSelect,
  onPointerDown,
}: DeckCardProps) => {
  const metrics = getCardMetrics(offset, cardWidth);
  const imdbLabel = formatImdbRating(title.imdbRating);
  const showCaption = Math.abs(offset) < 3.2;

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
          "relative block h-full overflow-hidden rounded-2xl border bg-[#1c2228] [&_img]:pointer-events-none",
          isDragging ? "cursor-grabbing" : "cursor-grab",
          metrics.isActive ? "border-[#00e054]/40" : "border-white/10",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e054]",
        )}
        draggable={false}
      >
        <PosterImage
          name={title.name}
          posterPath={title.posterPath}
          priority={metrics.isActive}
          className="absolute inset-0 h-full w-full rounded-none [aspect-ratio:auto]"
        />
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
          <p className="truncate text-xs text-[#ff8000]">
            {formatRating(title.rating)}
            {imdbLabel ? ` · ${imdbLabel}` : ""}
          </p>
        </div>
      </Link>
    </article>
  );
};

export const CoverflowDeck = ({ titles, className, footer }: CoverflowDeckProps) => {
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [cardWidth, setCardWidth] = useState(CARD_WIDTH);
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

  useEffect(() => {
    const updateWidth = () => {
      setCardWidth(window.innerWidth < 640 ? CARD_WIDTH_MOBILE : CARD_WIDTH);
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  if (titles.length === 0) {
    return null;
  }

  const roundedActive = Math.round(displayIndex);
  const activeTitle = titles[roundedActive];
  const firstVisible = Math.max(0, Math.floor(displayIndex) - VISIBLE_BEFORE);
  const lastVisible = Math.min(titles.length - 1, Math.ceil(displayIndex) + VISIBLE_AFTER);
  const visibleTitles = titles.slice(firstVisible, lastVisible + 1);

  return (
    <div className={cn("space-y-6", className)}>
      <div
        ref={containerRef}
        role="listbox"
        aria-label="Mazo de títulos"
        aria-activedescendant={`coverflow-item-${activeTitle.id}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onClickCapture={handleClickCapture}
        className="relative cursor-grab touch-none select-none overflow-visible rounded-2xl border border-[#1f262d] bg-gradient-to-b from-[#0c1014] via-[#14181c] to-[#0a0d10] px-2 py-10 outline-none focus-visible:ring-2 focus-visible:ring-[#00e054]/60 active:cursor-grabbing sm:px-8 sm:py-14"
      >
        <div
          className="relative mx-auto"
          style={{
            height: cardWidth * 1.62,
            maxWidth: "100%",
            overflow: "visible",
            perspective: "1600px",
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
                  cardWidth={cardWidth}
                  isDragging={isDragging}
                  onSelect={handleSelectCard}
                  onPointerDown={handlePointerDown}
                />
              );
            })}
          </div>
        </div>

        <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[11px] uppercase tracking-[0.18em] text-[#556]">
          Arrastra · rueda · desliza
        </p>
      </div>

      {activeTitle ? (
        <div className="mx-auto max-w-xl space-y-3 text-center">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-[#00e054]">
              {roundedActive + 1} / {titles.length}
            </p>
            <h2 className="font-serif text-2xl text-white sm:text-3xl">
              <Link
                href={`/titulos/${activeTitle.id}`}
                className="hover:text-[#00e054] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e054]"
              >
                {activeTitle.name}
              </Link>
            </h2>
            <p className="text-sm text-[#99aabb]">
              {TITLE_KIND_LABEL[activeTitle.kind]}
              {activeTitle.year ? ` · ${activeTitle.year}` : ""}
              {activeTitle.platform
                ? ` · ${PLATFORM_LABEL[activeTitle.platform]}`
                : ""}
            </p>
            <p className="text-sm text-[#ff8000]">{formatRating(activeTitle.rating)}</p>
          </div>
          {activeTitle.flatrateProviders && activeTitle.flatrateProviders.length > 0 ? (
            <WatchProviderChips
              providers={activeTitle.flatrateProviders}
              max={5}
              className="pt-1"
            />
          ) : null}
          {footer ? footer(activeTitle, roundedActive, true) : null}
        </div>
      ) : null}
    </div>
  );
};
