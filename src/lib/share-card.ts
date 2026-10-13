import { ratingToStars } from "@/lib/labels";

/** Five slots of 1 / 0.5 / 0 for a 0–10 rating (half stars), for the share page and its OG card. */
export const starFills = (rating: number | null | undefined): number[] => {
  const stars = ratingToStars(rating);
  if (stars == null) {
    return [];
  }
  return [1, 2, 3, 4, 5].map((slot) => (stars >= slot ? 1 : stars >= slot - 0.5 ? 0.5 : 0));
};

/** A review cut at a word boundary for the OG card and share text. */
export const excerpt = (text: string | null | undefined, max: number) => {
  const clean = text?.replace(/\s+/g, " ").trim() ?? "";
  if (clean.length <= max) {
    return clean;
  }
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:—-]+$/, "")}…`;
};

export const STAR_PATH = "m12 2.8 2.83 5.73 6.33.92-4.58 4.46 1.08 6.3L12 17.24l-5.66 2.97 1.08-6.3-4.58-4.46 6.33-.92Z";
