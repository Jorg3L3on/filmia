import type { ShelfDims } from "@/lib/para-ti/shelf-geometry";

/** A spine's title, cut to two lines before the CSS clamp (vertical clamping is uneven across browsers). */
export const spineLabel = (name: string, dims: ShelfDims) => {
  const perLine = Math.max(8, Math.floor((dims.height * 0.7) / 8.4));
  const max = perLine * 2;
  return name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name;
};
