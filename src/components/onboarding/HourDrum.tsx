"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import {
  BEDTIME_SLOTS,
  bedtimeValueText,
  slotToHHMM,
} from "@/lib/onboarding/bedtime";
import { focusRing } from "@/lib/ui";

const TICK_PX = 64;

type HourDrumProps = {
  slot: number;
  onSlot: (slot: number) => void;
  label: string;
};

/**
 * Horizontal snap drum, 15-minute ticks from 20:00 to 03:00. Pointer: scroll / drag / tap a tick.
 * Keyboard (role=slider): ←/→ ±15 min, Shift ±1 h, Home/End.
 */
export const HourDrum = ({ slot, onSlot, label }: HourDrumProps) => {
  const scroller = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmatic = useRef(false);

  const scrollTo = useCallback((next: number, behavior: ScrollBehavior = "smooth") => {
    const node = scroller.current;
    if (!node) {
      return;
    }
    programmatic.current = true;
    node.scrollTo({ left: next * TICK_PX, behavior });
    window.setTimeout(() => {
      programmatic.current = false;
    }, behavior === "smooth" ? 420 : 0);
  }, []);

  // Land on the saved hour without animating; follow external changes (target toggle).
  useEffect(() => {
    const node = scroller.current;
    if (!node) {
      return;
    }
    const current = Math.round(node.scrollLeft / TICK_PX);
    if (current !== slot) {
      scrollTo(slot, "auto");
    }
  }, [slot, scrollTo]);

  // Latest slot/onSlot for the scroll listeners without re-binding them on every render.
  const latest = useRef({ slot, onSlot });
  useEffect(() => {
    latest.current = { slot, onSlot };
  }, [slot, onSlot]);

  const settled = useCallback(() => {
    const node = scroller.current;
    if (!node || programmatic.current) {
      return;
    }
    const next = Math.min(BEDTIME_SLOTS - 1, Math.max(0, Math.round(node.scrollLeft / TICK_PX)));
    if (next !== latest.current.slot) {
      latest.current.onSlot(next);
    }
  }, []);

  const onScroll = () => {
    if (settle.current) {
      clearTimeout(settle.current);
    }
    settle.current = setTimeout(settled, 140);
  };

  useEffect(() => {
    const node = scroller.current;
    if (!node) {
      return;
    }
    node.addEventListener("scrollend", settled);
    return () => node.removeEventListener("scrollend", settled);
  }, [settled]);

  const step = (delta: number) => {
    const next = Math.min(BEDTIME_SLOTS - 1, Math.max(0, slot + delta));
    if (next !== slot) {
      onSlot(next);
      scrollTo(next);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const big = event.shiftKey ? 4 : 1;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        step(big);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        step(-big);
        break;
      case "Home":
        event.preventDefault();
        step(-slot);
        break;
      case "End":
        event.preventDefault();
        step(BEDTIME_SLOTS - 1 - slot);
        break;
      case "PageUp":
        event.preventDefault();
        step(4);
        break;
      case "PageDown":
        event.preventDefault();
        step(-4);
        break;
      default:
    }
  };

  const value = slotToHHMM(slot);

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={BEDTIME_SLOTS - 1}
      aria-valuenow={slot}
      aria-valuetext={bedtimeValueText(value)}
      onKeyDown={onKeyDown}
      className={cn("hour-drum-frame relative rounded-3xl", focusRing)}
    >
      <div className="hour-drum-needle" aria-hidden="true" />
      <div
        ref={scroller}
        onScroll={onScroll}
        className="hour-drum"
        style={{ paddingInline: `calc(50% - ${TICK_PX / 2}px)` }}
      >
        {Array.from({ length: BEDTIME_SLOTS }, (_, index) => {
          const hhmm = slotToHHMM(index);
          const isHour = hhmm.endsWith(":00");
          const isHalf = hhmm.endsWith(":30");
          return (
            <div
              key={index}
              onClick={() => {
                onSlot(index);
                scrollTo(index);
              }}
              className={cn("hour-tick", index === slot && "is-active", isHour && "is-hour")}
              style={{ width: TICK_PX }}
              aria-hidden="true"
            >
              <span className={cn("hour-tick-mark", isHour ? "h-5" : isHalf ? "h-3.5" : "h-2")} />
              <span className="hour-tick-label">{isHour ? hhmm : isHalf ? hhmm.slice(3) : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
