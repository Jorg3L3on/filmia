/**
 * Server-side caps for free text (FIL-I41-9). The forms use the same numbers as `maxLength`,
 * and the MCP tools validate with them too, so every path refuses the same input.
 */
export const LIST_NAME_MAX = 60;
export const LIST_DESCRIPTION_MAX = 300;
export const QUEUE_NOTE_MAX = 120;
export const PICK_LENS_MAX = 64;

export const LIST_NAME_TOO_LONG = `El nombre es demasiado largo (máximo ${LIST_NAME_MAX} caracteres).`;
export const LIST_DESCRIPTION_TOO_LONG = `La descripción es demasiado larga (máximo ${LIST_DESCRIPTION_MAX} caracteres).`;
export const QUEUE_NOTE_TOO_LONG = `La nota es demasiado larga (máximo ${QUEUE_NOTE_MAX} caracteres).`;

/** A lens is a short slug from the UI; anything longer is cut, never stored whole. */
export const clampLens = (lens: string | null | undefined) =>
  typeof lens === "string" && lens.length > 0 ? lens.slice(0, PICK_LENS_MAX) : null;
