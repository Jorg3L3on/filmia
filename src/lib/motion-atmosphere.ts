"use client";

/**
 * Atmosphere of the cinematic redesign (FIL-I46): film grain, projector beam and their
 * ambient loops. One rule decides whether they mount at all: never with reduced motion and
 * never in lite sala (a phone that could not hold the deck's frame rate, see `deck-lite`).
 */

import { useEffect, useSyncExternalStore, type RefObject } from "react";
import { isLowEndDevice } from "@/lib/deck-lite";
import { usePrefersReducedMotion } from "@/lib/motion";

/** sessionStorage key `useDeckLite` writes once the deck trips into lite. */
export const LITE_SESSION_KEY = "filmia:deck-lite";
const LITE_EVENT = "filmia:lite";

/** Pure rule, tested: ambient layers mount only with full motion and outside lite. */
export const shouldMountAtmosphere = ({ reducedMotion, lite }: { reducedMotion: boolean; lite: boolean }) =>
  !reducedMotion && !lite;

const readLite = () => {
  try {
    if (window.sessionStorage.getItem(LITE_SESSION_KEY) === "1") {
      return true;
    }
  } catch {
    // Private mode: fall through to the device hints.
  }
  if ("queVerLite" in document.documentElement.dataset) {
    return true;
  }
  return isLowEndDevice(navigator as Navigator & { deviceMemory?: number });
};

const subscribeLite = (onChange: () => void) => {
  window.addEventListener(LITE_EVENT, onChange);
  return () => window.removeEventListener(LITE_EVENT, onChange);
};

/** Tell every atmosphere layer that lite just switched on (called by `useDeckLite`). */
export const announceLite = () => {
  window.dispatchEvent(new Event(LITE_EVENT));
};

/** True on the server and during hydration, so nothing ambient renders before we know. */
export const useAtmosphereLite = () => useSyncExternalStore(subscribeLite, readLite, () => true);

/** Whether grain / beam / ambient loops may mount on this device right now. */
export const useAtmosphereOn = () => {
  const reducedMotion = usePrefersReducedMotion();
  const lite = useAtmosphereLite();
  return shouldMountAtmosphere({ reducedMotion, lite });
};

/**
 * Pauses an ambient loop while it is off screen: sets `data-ambient-paused` on the element,
 * which CSS turns into `animation-play-state: paused` for it and its children.
 */
export const useAmbientPause = (ref: RefObject<HTMLElement | null>, enabled = true) => {
  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        delete node.dataset.ambientPaused;
      } else {
        node.dataset.ambientPaused = "";
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, enabled]);
};

/** `html[data-ambient-paused]` while the tab is hidden: every ambient loop stops at once. */
export const usePauseAmbientWhenHidden = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const root = document.documentElement;
    const sync = () => {
      if (document.visibilityState === "hidden") {
        root.dataset.ambientPaused = "";
      } else {
        delete root.dataset.ambientPaused;
      }
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      delete root.dataset.ambientPaused;
    };
  }, [enabled]);
};

const SHIMMER = "shimmer";

const hasShimmer = (node: Node) =>
  node instanceof Element && (node.classList.contains(SHIMMER) || node.querySelector(`.${SHIMMER}`) !== null);

/** Every skeleton's light sweep on one clock: same phase on the document timeline. */
export const alignShimmers = (animations: Animation[]) => {
  for (const animation of animations) {
    if ((animation as CSSAnimation).animationName === SHIMMER && animation.startTime !== 0) {
      animation.startTime = 0;
    }
  }
};

/** One sweep across all the skeletons on screen instead of each block on its own beat. */
export const useSyncedShimmer = () => {
  useEffect(() => {
    if (typeof MutationObserver === "undefined" || typeof document.getAnimations !== "function") {
      return;
    }
    let frame = 0;
    const schedule = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        alignShimmers(document.getAnimations());
      });
    };
    schedule();
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (hasShimmer(node)) {
            schedule();
            return;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);
};
