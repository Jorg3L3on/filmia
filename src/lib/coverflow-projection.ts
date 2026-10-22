import { getCoverflowCardMetrics } from "@/lib/coverflow-metrics";

/** The cinematic stage's perspective (CoverflowDeck sets `perspective: 1400px`). */
export const COVERFLOW_STAGE_PERSPECTIVE = 1400;
/** The sala's side room: half the free width minus the cinematic inset (useCoverflowEngine). */
export const cinematicSideRoom = (stageWidth: number, cardWidth: number) =>
  Math.max(8, (stageWidth - cardWidth) / 2 - 2);

export type ProjectedCard = {
  /** Screen x of the card's inner and outer edges, relative to the stage centre (px). */
  inner: number;
  outer: number;
};

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Where a card at `offset` lands on screen (FIL-I21-4): the engine's transform
 * (translate3d → rotateY → scale around the card centre) followed by the stage's
 * perspective projection X·p/(p − Z). Only the x axis matters for the peek.
 */
export const projectCoverflowCard = (
  offset: number,
  stageWidth: number,
  cardWidth: number,
  perspective = COVERFLOW_STAGE_PERSPECTIVE,
): ProjectedCard => {
  const metrics = getCoverflowCardMetrics(offset, cinematicSideRoom(stageWidth, cardWidth), false, true);
  const half = (cardWidth / 2) * metrics.scale;
  const theta = toRad(metrics.rotateY);
  const project = (localX: number) => {
    // rotateY(θ): (x, z) → (x cos θ + z sin θ, −x sin θ + z cos θ), then the translation.
    const x = localX * Math.cos(theta) + metrics.translateX;
    const z = -localX * Math.sin(theta) + metrics.translateZ;
    return (x * perspective) / (perspective - z);
  };
  const side = Math.sign(offset) || 1;
  return { inner: project(-side * half), outer: project(side * half) };
};

/** How many px of the neighbour show past the hero's edge, and the air left to the stage edge. */
export const asomoAt = (stageWidth: number, cardWidth: number) => {
  const hero = projectCoverflowCard(0, stageWidth, cardWidth);
  const next = projectCoverflowCard(1, stageWidth, cardWidth);
  const second = projectCoverflowCard(2, stageWidth, cardWidth);
  return {
    heroEdge: hero.outer,
    peek: Math.abs(next.outer) - Math.abs(hero.outer),
    air: stageWidth / 2 - Math.abs(next.outer),
    /** Positive when the ±2 card's inner edge hides behind the ±1 card. */
    secondBehind: Math.abs(next.outer) - Math.abs(second.inner),
  };
};
