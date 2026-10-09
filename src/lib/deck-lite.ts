/**
 * Lite sala: a phone that can't hold the deck's frame rate (old, cheap, or hot and
 * throttling) drops the costly layers — blurred washes, breaths, ghost, side-card blur —
 * instead of stuttering through them. Decided once per session, from how the deck's own
 * motion frames actually ran.
 */

/** Frames per window; only motion frames (settle, coast) are sampled. */
export const DECK_LITE_WINDOW = 24;
/** A window whose median frame is slower than this (< ~38 fps) is a slow window. */
export const DECK_LITE_SLOW_FRAME_MS = 26;
/** Consecutive slow windows before switching: one janky moment (decode, hydration) isn't enough. */
export const DECK_LITE_SLOW_WINDOWS = 2;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/** Feed it frame durations (ms); `push` returns true once the device should go lite. */
export const createFramePaceMonitor = ({
  windowSize = DECK_LITE_WINDOW,
  slowFrameMs = DECK_LITE_SLOW_FRAME_MS,
  slowWindows = DECK_LITE_SLOW_WINDOWS,
} = {}) => {
  let frames: number[] = [];
  let slowInARow = 0;
  return {
    push: (frameMs: number) => {
      // A tab switch or a paused rAF is not a slow frame.
      if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) {
        return false;
      }
      frames.push(frameMs);
      if (frames.length < windowSize) {
        return false;
      }
      slowInARow = median(frames) > slowFrameMs ? slowInARow + 1 : 0;
      frames = [];
      return slowInARow >= slowWindows;
    },
  };
};

type DeviceHints = { deviceMemory?: number; hardwareConcurrency?: number };

/** Clearly low-end before a single frame runs (Android Go class). Safari reports neither. */
export const isLowEndDevice = ({ deviceMemory, hardwareConcurrency }: DeviceHints) =>
  (deviceMemory != null && deviceMemory <= 2) ||
  (hardwareConcurrency != null && hardwareConcurrency > 0 && hardwareConcurrency <= 2);
