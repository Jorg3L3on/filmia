import { premiereDayLabel } from "@/lib/cine-alerts";

/**
 * «Llega a cines» made visible (FIL-I23-2). The model does not change: a film in Quiero ver
 * gets the push when it premieres, one switch per device in Perfil. These are only the words.
 */

/** Second line under «Quiero ver» in the anchored menu; only for a film that has not premiered. */
export const watchlistAlertHint = (film: { status: string; mxReleaseDate: string }, today: string) =>
  film.status === "upcoming" ? `Te avisamos ${premiereDayLabel(film.mxReleaseDate, today)}` : null;

/** The toast after adding an upcoming film to Quiero ver from Cine. */
export const watchlistAlertToast = (
  film: { name: string; status: string; mxReleaseDate: string },
  today: string,
  pushOnThisDevice: boolean,
) => {
  if (film.status !== "upcoming") {
    return null;
  }
  const day = premiereDayLabel(film.mxReleaseDate, today);
  return {
    title: "Añadida a Quiero ver",
    description: pushOnThisDevice
      ? `«${film.name}» se estrena ${day}. Te avisamos ese día.`
      : `«${film.name}» se estrena ${day}. Enciende los avisos en Perfil para enterarte.`,
    needsPush: !pushOnThisDevice,
  };
};
