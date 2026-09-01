"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import {
  formatImdbRating,
  formatRating,
  PLATFORM_LABEL,
  TITLE_KIND_LABEL,
} from "@/lib/labels";
import type { Platform, TitleKind } from "@/generated/prisma/client";

export type CoverflowTitle = {
  id: string;
  name: string;
  kind: TitleKind;
  year: number | null;
  rating: number | null;
  posterPath: string | null;
  platform: Platform | null;
  imdbRating: number | null;
};

type CoverflowDeckProps = {
  titles: CoverflowTitle[];
  className?: string;
  footer?: (title: CoverflowTitle, index: number, isActive: boolean) => React.ReactNode;
};

const CARD_WIDTH = 240;
const CARD_WIDTH_MOBILE = 168;
const DRAG_SENSITIVITY = 0.0045;
const WHEEL_SENSITIVITY = 0.0022;
const SPRING_TRANSITION =
  "transform 520ms cubic-bezier(0.34, 1.45, 0.64, 1), filter 380ms ease, opacity 380ms ease, box-shadow 380ms ease";

const clampIndex = (value: number, max: number) =>
  Math.min(Math.max(value, 0), Math.max(max, 0));

const getCardMetrics = (offset: number) => {
  const distance = Math.abs(offset);
  const direction = Math.sign(offset) || 1;

  const scaleX =
    distance < 0.08 ? 1 : Math.max(0.06, 1 - distance * 0.46);
  const scaleY =
    distance < 0.08 ? 1 : Math.max(0.84, 1 - distance * 0.06);
  const translateX = offset * 54 + direction * Math.min(distance, 3) * 4;
  const brightness = Math.max(0.18, 1 - distance * 0.32);
  const opacity = Math.max(0.42, 1 - distance * 0.1);
  const zIndex = Math.round(1000 - distance * 100);
  const shadow =
    distance < 0.08
      ? "0 28px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 224, 84, 0.08)"
      : "0 8px 24px rgba(0, 0, 0, 0.35)";

  return {
    scaleX,
    scaleY,
    translateX,
    brightness,
    opacity,
    zIndex,
    shadow,
    isActive: distance < 0.45,
  };
};

export const CoverflowDeck = ({ titles, className, footer }: CoverflowDeckProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [cardWidth, setCardWidth] = useState(CARD_WIDTH);
  const dragStartX = useRef(0);
  const dragStartIndex = useRef(0);
  const activeIndexRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  activeIndexRef.current = activeIndex;

  const snapTo = useCallback(
    (index: number) => {
      setActiveIndex(clampIndex(index, titles.length - 1));
    },
    [titles.length],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (titles.length <= 1) {
      return;
    }

    setIsDragging(true);
    dragStartX.current = event.clientX;
    dragStartIndex.current = activeIndex;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }

    const delta = event.clientX - dragStartX.current;
    const next = dragStartIndex.current - delta * DRAG_SENSITIVITY;
    setActiveIndex(clampIndex(next, titles.length - 1));
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }

    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    snapTo(Math.round(activeIndexRef.current));
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (titles.length <= 1) {
      return;
    }

    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;
    const next = activeIndex + delta * WHEEL_SENSITIVITY;
    snapTo(Math.round(clampIndex(next, titles.length - 1)));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      snapTo(activeIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      snapTo(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      snapTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      snapTo(titles.length - 1);
    }
  };

  useEffect(() => {
    setActiveIndex((current) => clampIndex(current, titles.length - 1));
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

  const roundedActive = Math.round(activeIndex);
  const activeTitle = titles[roundedActive];

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
        className="relative select-none overflow-visible rounded-2xl border border-[#1f262d] bg-gradient-to-b from-[#0c1014] via-[#14181c] to-[#0a0d10] px-2 py-10 outline-none focus-visible:ring-2 focus-visible:ring-[#00e054]/60 sm:px-6 sm:py-14"
      >
        <div
          className="relative mx-auto touch-pan-y"
          style={{ height: cardWidth * 1.55, maxWidth: "100%" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: cardWidth,
              height: cardWidth * 1.5,
              marginLeft: -cardWidth / 2,
              marginTop: -(cardWidth * 1.5) / 2,
            }}
          >
            {titles.map((title, index) => {
              const offset = index - activeIndex;
              const metrics = getCardMetrics(offset);
              const imdbLabel = formatImdbRating(title.imdbRating);

              return (
                <article
                  key={title.id}
                  id={`coverflow-item-${title.id}`}
                  role="option"
                  aria-selected={metrics.isActive}
                  className={cn(
                    "absolute inset-0 origin-center will-change-transform",
                    metrics.isActive ? "pointer-events-auto" : "pointer-events-none",
                  )}
                  style={{
                    transform: `translateX(${metrics.translateX}px) scale(${metrics.scaleX}, ${metrics.scaleY})`,
                    filter: `brightness(${metrics.brightness})`,
                    opacity: metrics.opacity,
                    zIndex: metrics.zIndex,
                    transition: isDragging ? "none" : SPRING_TRANSITION,
                    boxShadow: metrics.shadow,
                  }}
                >
                  <Link
                    href={`/titulos/${title.id}`}
                    tabIndex={metrics.isActive ? 0 : -1}
                    aria-label={`${title.name}${title.year ? ` (${title.year})` : ""}`}
                    className={cn(
                      "block h-full overflow-hidden rounded-2xl border bg-[#1c2228]",
                      metrics.isActive
                        ? "border-[#00e054]/35"
                        : "border-[#2c3440]/80",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e054]",
                    )}
                    draggable={false}
                  >
                    <PosterImage
                      name={title.name}
                      posterPath={title.posterPath}
                      priority={metrics.isActive}
                      className="h-[78%] rounded-t-2xl"
                    />
                    <div
                      className={cn(
                        "flex h-[22%] flex-col justify-center px-3",
                        metrics.isActive ? "opacity-100" : "opacity-0",
                      )}
                    >
                      <p className="truncate text-[10px] uppercase tracking-wider text-[#678]">
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
          {footer ? footer(activeTitle, roundedActive, true) : null}
        </div>
      ) : null}
    </div>
  );
};
