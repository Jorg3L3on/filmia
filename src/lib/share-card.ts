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

/** What Compartir sends next to the card and the link: «Athena · ★ 4.0 — «review…»». */
export const reviewShareText = (name: string, rating: number | null, review: string | null) => {
  const stars = ratingToStars(rating);
  const head = stars == null ? name : `${name} · ★ ${stars.toFixed(1)}`;
  const quote = excerpt(review, 140);
  return quote ? `${head} — «${quote}»` : head;
};

export const listShareText = (name: string, total: number) =>
  `${name} · ${total === 1 ? "1 título" : `${total} títulos`} en Filmia`;

/**
 * What «Compartir» sends for «Tu mes en cine» (FIL-I46-5): only the person's own month — counts,
 * hours, top genre and their best-rated film. Nothing about anyone else.
 */
export const monthShareText = ({
  monthLabel,
  count,
  hours,
  topGenre,
  best,
}: {
  monthLabel: string;
  count: number;
  hours: number;
  topGenre: string | null;
  best: { name: string; rating: number | null } | null;
}) => {
  const parts = [`Mi ${monthLabel} en cine: ${count === 1 ? "1 título" : `${count} títulos`}`];
  if (hours > 0) parts.push(`${hours} h`);
  if (topGenre) parts.push(`sobre todo ${topGenre.toLowerCase()}`);
  const stars = ratingToStars(best?.rating);
  const head = parts.join(" · ");
  return best ? `${head}. La mejor: ${best.name}${stars == null ? "" : ` ★ ${stars.toFixed(1)}`}` : head;
};
