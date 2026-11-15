import {
  clampCoverflowIndex,
  coverflowTransform,
  getCoverflowCardMetrics,
  isCoverflowCardCulled,
  quantizeCoverflowBlur,
  COVERFLOW_COAST_FRICTION,
  COVERFLOW_COAST_MIN_VELOCITY,
  COVERFLOW_SPRING_REST_OFFSET,
  COVERFLOW_SPRING_REST_VELOCITY,
  stepCoverflowSpring,
} from "@/lib/coverflow-metrics";

/**
 * The release of a swipe (fling + settle) worked out once, in the engine's own formulas, so the
 * browser can play it on its compositor instead of JS writing styles every frame (FIL-I58-5).
 * One sample per 60 Hz frame: the same steps the rAF loop would have taken at 60 Hz.
 */
export type ReleaseSample = {
  /** Milliseconds from the release. */
  t: number;
  /** Where the deck is, in cards. */
  index: number;
};

export type Release = {
  samples: ReleaseSample[];
  restIndex: number;
  durationMs: number;
};

const STEP_SECONDS = 1 / 60;
/** A release never plays longer than this (the spring rests in ~0.5 s, a fling in ~1 s). */
const MAX_STEPS = 240;

type ReleaseInput = {
  /** Where the deck is when the finger lifts, in cards. */
  display: number;
  /** Fling velocity, cards per 60 Hz frame (0 for a plain settle). */
  velocity: number;
  /** Spring velocity for a settle with no fling, cards per second. */
  springVelocity: number;
  /** Last card index. */
  ceiling: number;
  /** A settle with no fling goes to this card. */
  settleTarget: number;
  coasting: boolean;
};

export const planRelease = ({
  display: startDisplay,
  velocity: startVelocity,
  springVelocity: startSpringVelocity,
  ceiling,
  settleTarget,
  coasting,
}: ReleaseInput): Release => {
  const frames = STEP_SECONDS * 60;
  let display = startDisplay;
  let velocity = startVelocity;
  let springVelocity = startSpringVelocity;
  let target = settleTarget;
  let mode: "coast" | "spring" = coasting ? "coast" : "spring";
  const samples: ReleaseSample[] = [{ t: 0, index: display }];
  let restIndex = clampCoverflowIndex(target, ceiling);

  for (let step = 1; step <= MAX_STEPS; step += 1) {
    if (mode === "coast") {
      display = clampCoverflowIndex(display + velocity * frames, ceiling);
      velocity *= COVERFLOW_COAST_FRICTION ** frames;
      const atEdge = (display <= 0 && velocity < 0) || (display >= ceiling && velocity > 0);
      if (atEdge || Math.abs(velocity) < COVERFLOW_COAST_MIN_VELOCITY) {
        target = clampCoverflowIndex(Math.round(display), ceiling);
        springVelocity = atEdge ? 0 : velocity * 60;
        velocity = 0;
        mode = "spring";
      }
    } else {
      const gap = display - target;
      const settled =
        Math.abs(gap) < COVERFLOW_SPRING_REST_OFFSET &&
        Math.abs(springVelocity) < COVERFLOW_SPRING_REST_VELOCITY;
      if (settled) {
        restIndex = target;
        samples.push({ t: step * STEP_SECONDS * 1000, index: target });
        return { samples, restIndex, durationMs: step * STEP_SECONDS * 1000 };
      }
      const next = stepCoverflowSpring(gap, springVelocity, STEP_SECONDS);
      display = clampCoverflowIndex(target + next.offset, ceiling);
      springVelocity = next.velocity;
    }
    samples.push({ t: step * STEP_SECONDS * 1000, index: display });
  }

  restIndex = clampCoverflowIndex(Math.round(display), ceiling);
  samples[samples.length - 1] = { t: samples[samples.length - 1]!.t, index: restIndex };
  return { samples, restIndex, durationMs: samples[samples.length - 1]!.t };
};

/** Where the deck is `t` ms into a planned release (linear between samples). */
export const releaseIndexAt = (release: Release, t: number) => {
  const { samples } = release;
  if (t <= 0) {
    return samples[0]!.index;
  }
  const last = samples[samples.length - 1]!;
  if (t >= last.t) {
    return last.index;
  }
  const i = Math.min(samples.length - 2, Math.floor(t / (STEP_SECONDS * 1000)));
  const a = samples[i]!;
  const b = samples[i + 1]!;
  return a.index + ((b.index - a.index) * (t - a.t)) / (b.t - a.t);
};

export type ReleaseFrames = {
  /** transform + opacity of the card's mover. */
  mover: Keyframe[];
  /** The dimming veil's opacity. */
  dim: Keyframe[];
  /** The face's blur (none on the hero and in the Asomo neighbours). */
  face: Keyframe[];
};

/** A keyframe every other 60 Hz frame (30 Hz, linear between): the curves are smooth and it halves the work. */
const KEYFRAME_STRIDE = 2;

/**
 * One card's keyframes, sampled through the same metrics the engine paints with, or null when
 * the card is never on screen during the release (culled the whole way).
 */
export const releaseKeyframes = (
  release: Release,
  cardIndex: number,
  sideRoom: number,
  compact: boolean,
  cinematic: boolean,
): ReleaseFrames | null => {
  const frames: ReleaseFrames = { mover: [], dim: [], face: [] };
  const duration = release.durationMs || 1;
  const last = release.samples.length - 1;
  let everVisible = false;
  let anyBlur = false;
  let dimMin = 1;
  let dimMax = 0;
  release.samples.forEach((sample, i) => {
    if (i % KEYFRAME_STRIDE !== 0 && i !== last) {
      return;
    }
    const offsetCards = cardIndex - sample.index;
    if (!isCoverflowCardCulled(offsetCards, sideRoom, cinematic)) {
      everVisible = true;
    }
    const metrics = getCoverflowCardMetrics(offsetCards, sideRoom, compact, cinematic);
    const offset = Math.min(1, sample.t / duration);
    frames.mover.push({
      offset,
      transform: coverflowTransform(metrics, false),
      opacity: String(metrics.opacity),
    });
    const dim = 1 - metrics.brightness;
    dimMin = Math.min(dimMin, dim);
    dimMax = Math.max(dimMax, dim);
    frames.dim.push({ offset, opacity: dim.toFixed(2) });
    const blur = metrics.isActive ? 0 : quantizeCoverflowBlur(metrics.blur);
    anyBlur ||= blur > 0;
    frames.face.push({ offset, filter: blur > 0 ? `blur(${blur}px)` : "none" });
  });
  if (!everVisible) {
    return null;
  }
  if (!anyBlur) {
    frames.face = [];
  }
  if (dimMax - dimMin < 0.005) {
    frames.dim = [];
  }
  return frames;
};

/** What changes without being animated: the focused card, stacking order and culling. */
export const releaseStateKey = (index: number) =>
  `${Math.round(index)}:${Math.abs(index - Math.round(index)) < 0.45}`;

/** Opt-in until Jorge's phones confirm it: `?mazo=waapi` turns it on for the tab, `?mazo=raf` off. */
export const compositorReleaseEnabled = () => {
  if (typeof window === "undefined") {
    return false;
  }
  const key = "filmia-mazo-release";
  const param = new URLSearchParams(window.location.search).get("mazo");
  try {
    if (param === "waapi") {
      window.sessionStorage.setItem(key, "1");
    } else if (param === "raf") {
      window.sessionStorage.removeItem(key);
    }
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return param === "waapi";
  }
};
