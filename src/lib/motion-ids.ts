export const POSTER_TRANSITION_PREFIX = "poster-";
export const DIARY_STAGE_NAME = "diary-stage";
export const DIARY_MONTH_NAME = "diary-month";

export const posterTransitionName = (titleId: string) =>
  `${POSTER_TRANSITION_PREFIX}${titleId}`;
