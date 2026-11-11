export type DeckViewMode = "deck" | "grid" | "calendar" | "strip";

/** «Tira» (FIL-I46-5) joins the three views; it replaces none. */
export const DIARY_VIEW_MODES: DeckViewMode[] = ["deck", "grid", "calendar", "strip"];

export const HISTORIAL_DEFAULT_VIEW: DeckViewMode = "calendar";
