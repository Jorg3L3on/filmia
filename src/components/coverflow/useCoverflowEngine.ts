"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  COVERFLOW_CARD_WIDTH,
  COVERFLOW_CARD_WIDTH_SHEET,
  COVERFLOW_COAST_FRICTION,
  COVERFLOW_COAST_MIN_VELOCITY,
  COVERFLOW_DRAG_THRESHOLD,
  COVERFLOW_SNAP_LERP,
  COVERFLOW_WHEEL_SENSITIVITY,
  COVERFLOW_WHEEL_SNAP_MS,
  clampCoverflowIndex,
  measureCoverflowCardWidth,
  paintCoverflowCard,
  prefersCoverflowReducedMotion,
  type CoverflowPaintedCard,
} from "@/lib/coverflow-metrics";

export type CoverflowEdgeDirection = "prev" | "next";

type CoverflowEngineOptions = {
  initialIndex?: number;
  /** Fired when the user keeps swiping/wheeling past the first/last card. */
  onEdgeNavigate?: (direction: CoverflowEdgeDirection) => void;
};

type CoverflowEngine = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  stageRef: React.RefObject<HTMLDivElement | null>;
  activeIndex: number;
  cardWidth: number;
  stageWidth: number;
  stageHeight: number;
  registerNode: (index: number, node: HTMLElement | null) => void;
  handleSelectCard: (index: number) => void;
  handlePointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  handleClickCapture: (event: React.MouseEvent<HTMLDivElement>) => void;
};

const EDGE_NAVIGATE_THRESHOLD = 0.42;

export const useCoverflowEngine = (
  titlesLength: number,
  isSheet: boolean,
  cinematic = false,
  options: CoverflowEngineOptions = {},
): CoverflowEngine => {
  const { initialIndex = 0, onEdgeNavigate } = options;
  const startIndex = clampCoverflowIndex(
    initialIndex,
    Math.max(titlesLength - 1, 0),
  );
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [cardWidth, setCardWidth] = useState(
    isSheet ? COVERFLOW_CARD_WIDTH_SHEET : COVERFLOW_CARD_WIDTH,
  );
  const [stageWidth, setStageWidth] = useState(480);
  const [stageHeight, setStageHeight] = useState(360);
  const dragStartX = useRef(0);
  const dragStartIndex = useRef(0);
  const targetIndexRef = useRef(startIndex);
  const displayIndexRef = useRef(startIndex);
  const velocityRef = useRef(0);
  const prevPointerX = useRef(0);
  const prevPointerTime = useRef(0);
  const isDraggingRef = useRef(false);
  const motionModeRef = useRef<"idle" | "drag" | "coast">("idle");
  const suppressClick = useRef(false);
  const overscrollRef = useRef(0);
  const onEdgeNavigateRef = useRef(onEdgeNavigate);
  const titlesLengthRef = useRef(titlesLength);
  const cardWidthRef = useRef(COVERFLOW_CARD_WIDTH);
  const sideRoomRef = useRef(8);
  const compactRef = useRef(isSheet);
  const cinematicRef = useRef(cinematic);
  const activeIndexRef = useRef(startIndex);
  const rafRef = useRef<number | null>(null);
  const wheelSnapTimeout = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardNodes = useRef(new Map<number, CoverflowPaintedCard>());
  const tickRef = useRef<() => void>(() => {});

  const maxIndex = () => Math.max(titlesLengthRef.current - 1, 0);

  const tryEdgeNavigate = (direction: CoverflowEdgeDirection) => {
    const handler = onEdgeNavigateRef.current;
    if (!handler) {
      return false;
    }
    handler(direction);
    overscrollRef.current = 0;
    return true;
  };

  const setGrabbingCursor = (grabbing: boolean) => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    node.classList.toggle("cursor-grabbing", grabbing);
    node.classList.toggle("cursor-grab", !grabbing);
  };

  const stopRaf = () => {
    if (rafRef.current == null) {
      return;
    }

    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const paintCards = (moving: boolean) => {
    const display = displayIndexRef.current;
    const sideRoom = sideRoomRef.current;
    const compact = compactRef.current;

    cardNodes.current.forEach((node, index) => {
      paintCoverflowCard(
        node,
        index - display,
        sideRoom,
        compact,
        moving,
        cinematicRef.current,
      );
    });
  };

  const commitActiveIndex = () => {
    const next = clampCoverflowIndex(Math.round(displayIndexRef.current), maxIndex());
    if (next === activeIndexRef.current) {
      return;
    }

    activeIndexRef.current = next;
    setActiveIndex(next);
  };

  const registerNode = useCallback((index: number, node: HTMLElement | null) => {
    if (!node) {
      cardNodes.current.delete(index);
      return;
    }

    const painted: CoverflowPaintedCard = {
      root: node,
      face: node.querySelector("[data-coverflow-face]"),
      dim: node.querySelector("[data-coverflow-dim]"),
      caption: node.querySelector("[data-coverflow-caption]"),
      link: node.querySelector("a"),
    };
    cardNodes.current.set(index, painted);
    paintCoverflowCard(
      painted,
      index - displayIndexRef.current,
      sideRoomRef.current,
      compactRef.current,
      motionModeRef.current !== "idle" || isDraggingRef.current,
      cinematicRef.current,
    );
  }, []);

  const runTick = () => {
    const ceiling = maxIndex();
    const mode = motionModeRef.current;

    if (mode === "drag") {
      displayIndexRef.current = targetIndexRef.current;
      paintCards(true);
      commitActiveIndex();
      rafRef.current = null;
      return;
    }

    if (mode === "coast") {
      displayIndexRef.current = clampCoverflowIndex(
        displayIndexRef.current + velocityRef.current,
        ceiling,
      );
      velocityRef.current *= COVERFLOW_COAST_FRICTION;

      const atEdge =
        (displayIndexRef.current <= 0 && velocityRef.current < 0) ||
        (displayIndexRef.current >= ceiling && velocityRef.current > 0);

      if (atEdge || Math.abs(velocityRef.current) < COVERFLOW_COAST_MIN_VELOCITY) {
        motionModeRef.current = "idle";
        targetIndexRef.current = clampCoverflowIndex(
          Math.round(displayIndexRef.current),
          ceiling,
        );
        velocityRef.current = 0;
      } else {
        targetIndexRef.current = displayIndexRef.current;
      }
    }

    if (motionModeRef.current === "idle") {
      const gap = targetIndexRef.current - displayIndexRef.current;
      const snapStep = prefersCoverflowReducedMotion() ? 1 : COVERFLOW_SNAP_LERP;
      if (Math.abs(gap) < 0.001 || snapStep >= 1) {
        displayIndexRef.current = targetIndexRef.current;
        paintCards(false);
        commitActiveIndex();
        rafRef.current = null;
        return;
      }

      displayIndexRef.current += gap * snapStep;
    }

    paintCards(true);
    commitActiveIndex();
    rafRef.current = requestAnimationFrame(() => tickRef.current());
  };

  const ensureTick = useCallback(() => {
    if (rafRef.current != null) {
      return;
    }

    rafRef.current = requestAnimationFrame(() => tickRef.current());
  }, []);

  const snapTo = useCallback(
    (index: number) => {
      motionModeRef.current = "idle";
      velocityRef.current = 0;
      targetIndexRef.current = clampCoverflowIndex(index, titlesLength - 1);
      ensureTick();
    },
    [ensureTick, titlesLength],
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
    setGrabbingCursor(false);

    const ceiling = maxIndex();
    const overscroll = overscrollRef.current;
    if (overscroll < -EDGE_NAVIGATE_THRESHOLD && activeIndexRef.current <= 0) {
      if (tryEdgeNavigate("prev")) {
        motionModeRef.current = "idle";
        velocityRef.current = 0;
        return;
      }
    }
    if (overscroll > EDGE_NAVIGATE_THRESHOLD && activeIndexRef.current >= ceiling) {
      if (tryEdgeNavigate("next")) {
        motionModeRef.current = "idle";
        velocityRef.current = 0;
        return;
      }
    }
    overscrollRef.current = 0;

    const projected = displayIndexRef.current + velocityRef.current * 10;
    const nearest = clampCoverflowIndex(Math.round(projected), ceiling);

    if (Math.abs(velocityRef.current) > COVERFLOW_COAST_MIN_VELOCITY * 3) {
      motionModeRef.current = "coast";
    } else {
      motionModeRef.current = "idle";
      targetIndexRef.current = nearest;
    }

    ensureTick();
  }, [ensureTick]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (titlesLengthRef.current <= 0 || event.button !== 0) {
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
    overscrollRef.current = 0;
    setGrabbingCursor(true);
    stopRaf();
    paintCards(true);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isDraggingRef.current) {
        return;
      }

      const now = performance.now();
      const dt = Math.max(8, now - prevPointerTime.current);
      const dx = event.clientX - prevPointerX.current;
      const cardSpan = cardWidthRef.current * 0.52;
      const instantVelocity = (-dx / cardSpan) * (16.67 / dt);

      velocityRef.current = velocityRef.current * 0.68 + instantVelocity * 0.32;
      prevPointerX.current = event.clientX;
      prevPointerTime.current = now;

      const delta = event.clientX - dragStartX.current;
      if (Math.abs(delta) > COVERFLOW_DRAG_THRESHOLD) {
        suppressClick.current = true;
      }

      const ceiling = maxIndex();
      const raw = dragStartIndex.current - delta / cardSpan;
      if (raw < 0) {
        overscrollRef.current = raw;
      } else if (raw > ceiling) {
        overscrollRef.current = raw - ceiling;
      } else {
        overscrollRef.current = 0;
      }
      const next = clampCoverflowIndex(raw, ceiling);
      targetIndexRef.current = next;
      displayIndexRef.current = next;
      ensureTick();
    };

    const handlePointerUp = () => {
      stopDragging();
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [ensureTick, stopDragging]);

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

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (titlesLengthRef.current <= 0) {
        return;
      }

      event.preventDefault();
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const ceiling = Math.max(titlesLengthRef.current - 1, 0);
      const raw = targetIndexRef.current + delta * COVERFLOW_WHEEL_SENSITIVITY;

      motionModeRef.current = "idle";
      velocityRef.current = 0;

      if (raw < 0) {
        overscrollRef.current = (overscrollRef.current || 0) + (raw - 0);
      } else if (raw > ceiling) {
        overscrollRef.current = (overscrollRef.current || 0) + (raw - ceiling);
      } else {
        overscrollRef.current = 0;
      }

      targetIndexRef.current = clampCoverflowIndex(raw, ceiling);
      ensureTick();

      if (wheelSnapTimeout.current != null) {
        window.clearTimeout(wheelSnapTimeout.current);
      }

      wheelSnapTimeout.current = window.setTimeout(() => {
        const edge = overscrollRef.current;
        if (edge < -EDGE_NAVIGATE_THRESHOLD && activeIndexRef.current <= 0) {
          if (tryEdgeNavigate("prev")) {
            wheelSnapTimeout.current = null;
            return;
          }
        }
        if (edge > EDGE_NAVIGATE_THRESHOLD && activeIndexRef.current >= ceiling) {
          if (tryEdgeNavigate("next")) {
            wheelSnapTimeout.current = null;
            return;
          }
        }
        overscrollRef.current = 0;
        targetIndexRef.current = clampCoverflowIndex(
          Math.round(targetIndexRef.current),
          titlesLengthRef.current - 1,
        );
        ensureTick();
        wheelSnapTimeout.current = null;
      }, COVERFLOW_WHEEL_SNAP_MS);
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, [ensureTick]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = Math.round(targetIndexRef.current) + 1;
      if (next > maxIndex()) {
        tryEdgeNavigate("next");
        return;
      }
      snapTo(next);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const next = Math.round(targetIndexRef.current) - 1;
      if (next < 0) {
        tryEdgeNavigate("prev");
        return;
      }
      snapTo(next);
    } else if (event.key === "Home") {
      event.preventDefault();
      snapTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      snapTo(titlesLength - 1);
    }
  };

  useLayoutEffect(() => {
    onEdgeNavigateRef.current = onEdgeNavigate;
  }, [onEdgeNavigate]);

  // Remount (key) applies initialIndex via useState. Clamp when the local deck
  // shrinks (mark seen) without remounting — adjust during render.
  const indexCeiling = Math.max(titlesLength - 1, 0);
  if (activeIndex > indexCeiling) {
    setActiveIndex(indexCeiling);
  }

  useLayoutEffect(() => {
    const ceiling = Math.max(titlesLength - 1, 0);
    if (displayIndexRef.current > ceiling || targetIndexRef.current > ceiling) {
      displayIndexRef.current = ceiling;
      targetIndexRef.current = ceiling;
      activeIndexRef.current = ceiling;
    }
  }, [activeIndex, titlesLength]);

  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) {
      return;
    }

    const measure = () => {
      const stage = node.clientWidth;
      const height = node.clientHeight;
      setStageWidth(stage);
      setStageHeight(height);
      setCardWidth(measureCoverflowCardWidth(stage, isSheet, height, cinematic));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [cinematic, isSheet, titlesLength]);

  useLayoutEffect(() => {
    titlesLengthRef.current = titlesLength;
    cardWidthRef.current = cardWidth;
    compactRef.current = isSheet;
    cinematicRef.current = cinematic;
    // Extra lateral room for soft L+R fan (cinematic); historial/sheet keep prior inset.
    sideRoomRef.current = Math.max(
      8,
      (stageWidth - cardWidth) / 2 - (isSheet ? 4 : cinematic ? 2 : 12),
    );
    tickRef.current = runTick;
  });

  useLayoutEffect(() => {
    paintCards(motionModeRef.current !== "idle" || isDraggingRef.current);
  }, [activeIndex, cardWidth, cinematic, stageWidth, titlesLength]);

  return {
    containerRef,
    stageRef,
    activeIndex,
    cardWidth,
    stageWidth,
    stageHeight,
    registerNode,
    handleSelectCard,
    handlePointerDown,
    handleKeyDown,
    handleClickCapture,
  };
};
