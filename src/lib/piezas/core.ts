/**
 * Quick answers about a film you saw, without stars (FIL-I26, now used by «Afina tu gusto» and the
 * ficha; «¿Las viste?» itself was replaced by La tanda in FIL-I50-8). An answer is stored as
 * `Title.impliedRating`, what the engine reads when the person gave no stars.
 */

export const VISTE_ANSWERS = ["liked", "meh", "no"] as const;
export type VisteAnswer = (typeof VISTE_ANSWERS)[number];

export const isVisteAnswer = (value: unknown): value is VisteAnswer =>
  VISTE_ANSWERS.includes(value as VisteAnswer);

/**
 * «La vi, me gustó» / «La vi, no tanto» as `Title.impliedRating` (liked = ≥ 7). «No la vi» writes
 * nothing. La tanda adds 10 for «Me encantó» (`TANDA_RATING`).
 */
export const VISTE_RATING: Record<Exclude<VisteAnswer, "no">, number> = { liked: 8, meh: 4 };

/** What an implied rating says in the UI instead of stars: «Te encantó» / «Te gustó» / «No tanto». */
export const impliedRatingLabel = (impliedRating: number | null | undefined) =>
  impliedRating == null
    ? null
    : impliedRating >= 10
      ? "Te encantó"
      : impliedRating >= VISTE_RATING.liked
        ? "Te gustó"
        : "No tanto";

export const VISTE_ANSWER_LABEL: Record<VisteAnswer, string> = {
  liked: "La vi, me gustó",
  meh: "La vi, no tanto",
  no: "No la vi",
};
