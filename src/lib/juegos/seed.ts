/**
 * Seeded randomness for the games (FIL-I52-1): the same seed gives the same numbers on every
 * server and every run, so a daily round is identical for everyone and a partida can be rebuilt.
 * Pure. Not for anything secret: the seed is not a secret, the stored sequence is what counts.
 */

/** 32-bit hash of a string (cyrb53's mixing, folded to 32 bits). */
export const hashSeed = (seed: string) => {
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    const code = seed.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
};

/** mulberry32: a function that returns floats in [0, 1), deterministic for a seed. */
export const seededRandom = (seed: string) => {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Fisher–Yates with a seeded generator; returns a new array. */
export const seededShuffle = <T>(items: readonly T[], seed: string): T[] => {
  const random = seededRandom(seed);
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [out[index], out[other]] = [out[other]!, out[index]!];
  }
  return out;
};
