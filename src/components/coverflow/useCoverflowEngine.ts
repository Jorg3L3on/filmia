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
  COVERFLOW_SPRING_REST_OFFSET,
  COVERFLOW_SPRING_REST_VELOCITY,
  COVERFLOW_WHEEL_SENSITIVITY,
  COVERFLOW_WHEEL_SNAP_MS,
  clampCoverflowIndex,
  measureCoverflowCardWidth,
  paintCoverflowCard,
  prefersCoverflowReducedMotion,
  stepCoverflowSpring,
  type CoverflowPaintedCard,
} from "@/lib/coverflow-metrics";

type CoverflowEngineOptions = {
  initialIndex?: number;
  /** Lite sala: no side-card blur, far jumps cut without the fade. */
  lite?: boolean;
  /** Each settle / coast frame's duration (ms), for the lite pace monitor. */
  onMotionFrame?: (frameMs: number) => void;
};

type CoverflowEngine = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  stageRef: React.RefObject<HTMLDivElement | null>;
  /** The cards' wrapper: a far `jumpTo` fades it through the cut. */
  cardsRef: React.RefObject<HTMLDivElement | null>;
  activeIndex: number;
  /**
   * Where the deck will come to rest: follows a tap, a key, a release or a rail jump,
   * but holds while a finger drags or a fling coasts. The footer reads this, so its
   * title doesn't strobe through every poster a swipe passes.
   */
  restingIndex: number;
  cardWidth: number;
  stageWidth: number;
  stageHeight: number;
  registerNode: (index: number, node: HTMLElement | null) => void;
  handleSelectCard: (index: number) => void;
  /** Parent-driven move (Hoy's lens rail): glide when close; when far, fade through a cut. */
  jumpTo: (index: number) => void;
  handlePointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  handleClickCapture: (event: React.MouseEvent<HTMLDivElement>) => void;
};

/** `jumpTo` glides up to this many cards; beyond, it fades through a cut. */
const JUMP_GLIDE_MAX = 3;
/** A far jump lands this many cards short and glides the rest, so it still reads as travel. */
const JUMP_LANDING_GLIDE = 1.2;
const JUMP_FADE_OUT_MS = 110;
const JUMP_FADE_IN_MS = 240;
/** Longest frame the motion integrates (a backgrounded tab must not teleport). */
const MAX_FRAME_SECONDS = 1 / 30;


export const useCoverflowEngine = (
  titlesLength: number,
  isSheet: boolean,
  cinematic = false,
  options: CoverflowEngineOptions = {},
): CoverflowEngine => {
  const { initialIndex = 0, lite = false, onMotionFrame } = options;
  const liteRef = useRef(lite);
  const onMotionFrameRef = useRef(onMotionFrame);
  const startIndex = clampCoverflowIndex(
    initialIndex,
    Math.max(titlesLength - 1, 0),
  );
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [restingIndex, setRestingIndex] = useState(startIndex);
  const [cardWidth, setCardWidth] = useState(
    isSheet ? COVERFLOW_CARD_WIDTH_SHEET : COVERFLOW_CARD_WIDTH,
  );
  const [stageWidth, setStageWidth] = useState(480);
  const [stageHeight, setStageHeight] = useState(360);
  const dragStartX = useRef(0);
  const dragStartIndex = useRef(0);
  const targetIndexRef = useRef(startIndex);
  const displayIndexRef = useRef(startIndex);
  /** Drag / coast velocity, cards per 60 Hz frame. */
  const velocityRef = useRef(0);
  /** Spring velocity while settling, cards per second. */
  const springVelocityRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  /**
   * Set while a far jump glides its last stretch: the active card is already the target,
   * so Hoy's rail never flicks back to the lens the glide starts in.
   */
  const jumpLandingRef = useRef<number | null>(null);
  /** A far jump in flight; `cut` is set until the fade-out ends and the deck moves. */
  const jumpFadeRef = useRef<{ animation: Animation; cut: (() => void) | null } | null>(null);
  const prevPointerX = useRef(0);
  const prevPointerTime = useRef(0);
  const isDraggingRef = useRef(false);
  const motionModeRef = useRef<"idle" | "drag" | "coast">("idle");
  const suppressClick = useRef(false);
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
  const cardsRef = useRef<HTMLDivElement>(null);
  const cardNodes = useRef(new Map<number, CoverflowPaintedCard>());
  const tickRef = useRef<(now: number) => void>(() => {});

  const maxIndex = () => Math.max(titlesLengthRef.current - 1, 0);

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
    lastFrameRef.current = null;
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
        liteRef.current,
      );
    });
  };

  const commitActiveIndex = () => {
    const next = clampCoverflowIndex(
      jumpLandingRef.current ?? Math.round(displayIndexRef.current),
      maxIndex(),
    );
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
      liteRef.current,
    );
  }, []);

  const runTick = (now: number) => {
    const ceiling = maxIndex();
    const mode = motionModeRef.current;
    if (lastFrameRef.current != null && mode !== "drag") {
      onMotionFrameRef.current?.(now - lastFrameRef.current);
    }
    const dt =
      lastFrameRef.current == null
        ? 1 / 60
        : Math.min(MAX_FRAME_SECONDS, Math.max(0, (now - lastFrameRef.current) / 1000));
    lastFrameRef.current = now;
    const frames = dt * 60;

    if (mode === "drag") {
      displayIndexRef.current = targetIndexRef.current;
      paintCards(true);
      commitActiveIndex();
      rafRef.current = null;
      lastFrameRef.current = null;
      return;
    }

    if (mode === "coast") {
      displayIndexRef.current = clampCoverflowIndex(
        displayIndexRef.current + velocityRef.current * frames,
        ceiling,
      );
      velocityRef.current *= COVERFLOW_COAST_FRICTION ** frames;

      const atEdge =
        (displayIndexRef.current <= 0 && velocityRef.current < 0) ||
        (displayIndexRef.current >= ceiling && velocityRef.current > 0);

      if (atEdge || Math.abs(velocityRef.current) < COVERFLOW_COAST_MIN_VELOCITY) {
        motionModeRef.current = "idle";
        const rest = clampCoverflowIndex(Math.round(displayIndexRef.current), ceiling);
        targetIndexRef.current = rest;
        setRestingIndex(rest);
        // Hand the fling's leftover speed to the spring: no hitch between the two.
        springVelocityRef.current = atEdge ? 0 : velocityRef.current * 60;
        velocityRef.current = 0;
      } else {
        targetIndexRef.current = displayIndexRef.current;
      }
    }

    if (motionModeRef.current === "idle") {
      const gap = displayIndexRef.current - targetIndexRef.current;
      const settled =
        Math.abs(gap) < COVERFLOW_SPRING_REST_OFFSET &&
        Math.abs(springVelocityRef.current) < COVERFLOW_SPRING_REST_VELOCITY;
      if (settled || prefersCoverflowReducedMotion()) {
        displayIndexRef.current = targetIndexRef.current;
        springVelocityRef.current = 0;
        jumpLandingRef.current = null;
        paintCards(false);
        commitActiveIndex();
        rafRef.current = null;
        lastFrameRef.current = null;
        return;
      }

      const next = stepCoverflowSpring(gap, springVelocityRef.current, dt);
      displayIndexRef.current = clampCoverflowIndex(
        targetIndexRef.current + next.offset,
        ceiling,
      );
      springVelocityRef.current = next.velocity;
    }

    paintCards(true);
    commitActiveIndex();
    rafRef.current = requestAnimationFrame((time) => tickRef.current(time));
  };

  const ensureTick = useCallback(() => {
    if (rafRef.current != null) {
      return;
    }

    rafRef.current = requestAnimationFrame((time) => tickRef.current(time));
  }, []);

  /** Stops a far jump's fade; `land` still makes the pending cut (straight onto the target). */
  const cancelJumpFade = (land: boolean) => {
    const fade = jumpFadeRef.current;
    if (!fade) {
      return;
    }
    jumpFadeRef.current = null;
    jumpLandingRef.current = null;
    fade.animation.cancel();
    if (land) {
      fade.cut?.();
    }
  };

  const snapTo = useCallback(
    (index: number) => {
      const target = clampCoverflowIndex(index, titlesLength - 1);
      jumpLandingRef.current = null;
      motionModeRef.current = "idle";
      velocityRef.current = 0;
      targetIndexRef.current = target;
      setRestingIndex(target);
      ensureTick();
    },
    [ensureTick, titlesLength],
  );

  const jumpTo = useCallback(
    (index: number) => {
      const target = clampCoverflowIndex(index, titlesLengthRef.current - 1);
      // Gliding across a whole chapter strobes through posters: fade out, land just
      // short of the target on the side we came from, and glide the last stretch in.
      if (Math.abs(target - displayIndexRef.current) <= JUMP_GLIDE_MAX) {
        snapTo(target);
        return;
      }
      cancelJumpFade(false);
      const direction = Math.sign(target - displayIndexRef.current);
      const cut = (glide: boolean) => {
        motionModeRef.current = "idle";
        velocityRef.current = 0;
        springVelocityRef.current = 0;
        targetIndexRef.current = target;
        jumpLandingRef.current = glide ? target : null;
        displayIndexRef.current = glide
          ? clampCoverflowIndex(target - direction * JUMP_LANDING_GLIDE, maxIndex())
          : target;
        paintCards(glide);
        commitActiveIndex();
        if (glide) {
          ensureTick();
        }
      };
      setRestingIndex(target);

      const cards = cardsRef.current;
      if (
        !cards ||
        liteRef.current ||
        prefersCoverflowReducedMotion() ||
        typeof cards.animate !== "function"
      ) {
        cut(false);
        return;
      }
      stopRaf();
      const fadeOut = cards.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: JUMP_FADE_OUT_MS,
        easing: "cubic-bezier(0.4, 0, 1, 1)",
        fill: "forwards",
      });
      jumpFadeRef.current = { animation: fadeOut, cut: () => cut(false) };
      fadeOut.onfinish = () => {
        if (jumpFadeRef.current?.animation !== fadeOut) {
          return;
        }
        cut(true);
        const fadeIn = cards.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: JUMP_FADE_IN_MS,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        });
        fadeOut.cancel();
        jumpFadeRef.current = { animation: fadeIn, cut: null };
        fadeIn.onfinish = () => {
          if (jumpFadeRef.current?.animation === fadeIn) {
            jumpFadeRef.current = null;
          }
        };
      };
    },
    // commitActiveIndex / paintCards only touch refs and the stable setActiveIndex.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ensureTick, snapTo],
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
    const projected = displayIndexRef.current + velocityRef.current * 10;
    const nearest = clampCoverflowIndex(Math.round(projected), ceiling);

    if (Math.abs(velocityRef.current) > COVERFLOW_COAST_MIN_VELOCITY * 3) {
      motionModeRef.current = "coast";
      // A coast travels ~velocity × 10 (friction 0.9): name where it lands now, so the
      // footer changes on release; the coast's end corrects it if the guess is one off.
      setRestingIndex(nearest);
    } else {
      motionModeRef.current = "idle";
      targetIndexRef.current = nearest;
      springVelocityRef.current = velocityRef.current * 60;
      setRestingIndex(nearest);
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

    // Grabbed mid-jump: land on the target now and hand the deck back at full opacity.
    cancelJumpFade(true);

    jumpLandingRef.current = null;
    isDraggingRef.current = true;
    motionModeRef.current = "drag";
    springVelocityRef.current = 0;
    suppressClick.current = false;
    dragStartX.current = event.clientX;
    dragStartIndex.current = displayIndexRef.current;
    prevPointerX.current = event.clientX;
    prevPointerTime.current = performance.now();
    velocityRef.current = 0;
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
      jumpFadeRef.current?.animation.cancel();
      jumpFadeRef.current = null;
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
      jumpLandingRef.current = null;

      targetIndexRef.current = clampCoverflowIndex(raw, ceiling);
      ensureTick();

      if (wheelSnapTimeout.current != null) {
        window.clearTimeout(wheelSnapTimeout.current);
      }

      wheelSnapTimeout.current = window.setTimeout(() => {
        const rest = clampCoverflowIndex(
          Math.round(targetIndexRef.current),
          titlesLengthRef.current - 1,
        );
        targetIndexRef.current = rest;
        setRestingIndex(rest);
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
      snapTo(Math.round(targetIndexRef.current) + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      snapTo(Math.round(targetIndexRef.current) - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      snapTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      snapTo(titlesLength - 1);
    }
  };

  // Remount (key) applies initialIndex via useState. Clamp when the local deck
  // shrinks (mark seen) without remounting — adjust during render.
  const indexCeiling = Math.max(titlesLength - 1, 0);
  if (activeIndex > indexCeiling) {
    setActiveIndex(indexCeiling);
  }
  if (restingIndex > indexCeiling) {
    setRestingIndex(indexCeiling);
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
    liteRef.current = lite;
    // Extra lateral room for soft L+R fan (cinematic); historial/sheet keep prior inset.
    sideRoomRef.current = Math.max(
      8,
      (stageWidth - cardWidth) / 2 - (isSheet ? 4 : cinematic ? 2 : 12),
    );
    tickRef.current = runTick;
    onMotionFrameRef.current = onMotionFrame;
  });

  useLayoutEffect(() => {
    paintCards(motionModeRef.current !== "idle" || isDraggingRef.current);
  }, [activeIndex, cardWidth, cinematic, lite, stageWidth, titlesLength]);

  return {
    containerRef,
    stageRef,
    cardsRef,
    activeIndex,
    restingIndex,
    cardWidth,
    stageWidth,
    stageHeight,
    registerNode,
    handleSelectCard,
    jumpTo,
    handlePointerDown,
    handleKeyDown,
    handleClickCapture,
  };
};
