import type { CoverflowTitle } from "@/components/coverflow/types";

/** The closing card's id in the deck (never a title id). */
export const CLOSING_CARD_ID = "__cierre__";

export type ClosingStats = {
  /** Cards dealt tonight (before any «Vi esto» or «Ahora no»). */
  total: number;
  /** Marked seen from Hoy in this session (Deshacer takes one back). */
  watched: number;
  /** Set aside with «Ahora no» in this session. */
  notTonight: number;
};

/**
 * The one closing card at the very end of the continuous deck (FIL-I21-6): the deck's floor
 * made visible, never a DestinationCard and never per lens. It carries the last lens so the
 * rail and the URL stay on the last chapter while it is the hero.
 */
export const closingCardFor = (lastLensSlug: string): CoverflowTitle => ({
  id: CLOSING_CARD_ID,
  name: "Eso es todo por hoy",
  kind: "MOVIE",
  year: null,
  rating: null,
  posterPath: null,
  platform: null,
  imdbRating: null,
  closing: true,
  tonight: {
    runtimeMinutes: null,
    reasons: [],
    headline: [],
    fit: { fit: 0, endsAt: "", overflowMinutes: 0, remainingMinutes: 0 },
    wildcard: false,
    pinned: false,
    queueNote: null,
    lens: lastLensSlug,
    posterAmbient: null,
    source: "queue",
  },
});

export const isClosingCard = (title: Pick<CoverflowTitle, "id" | "closing"> | null | undefined) =>
  Boolean(title && (title.closing || title.id === CLOSING_CARD_ID));

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** «10 cartas · 1 vista · 2 «ahora no»», or the consolation line when nothing was seen. */
export const closingCopy = ({ total, watched, notTonight }: ClosingStats) => {
  const cards = `${total} ${plural(total, "carta", "cartas")}`;
  const aside = `${notTonight} «ahora no»`;
  if (watched === 0) {
    return {
      headline: "Ninguna te convenció. Mañana baraja distinto.",
      counters: `${cards} · ${aside}`,
    };
  }
  return {
    headline: null,
    counters: `${cards} · ${watched} ${plural(watched, "vista", "vistas")} · ${aside}`,
  };
};
