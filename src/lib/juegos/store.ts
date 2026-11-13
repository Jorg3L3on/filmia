import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";
import { db, pickEvents } from "@/db";
import { mxToday } from "@/lib/cine-core";
import { JUEGOS, JUEGOS_OPENED_KIND, juegosNovedad, portadaOf, TANDA_ID, type Juego, type JuegosEntry } from "@/lib/juegos/core";
import { isSeenAnswer } from "@/lib/juegos/tanda/core";
import { readTanda } from "@/lib/juegos/tanda/store";

/**
 * Juegos on the database (FIL-I50-2): a visit to the portada is a `juegos_opened` event (its lens
 * says which door of Hoy it came through); Hoy's «nuevo» dot compares the last one with the cartel.
 */

export const lastJuegosOpenedAt = async (userId: string) => {
  const row = await db.query.pickEvents.findFirst({
    where: and(eq(pickEvents.userId, userId), eq(pickEvents.kind, JUEGOS_OPENED_KIND)),
    orderBy: [desc(pickEvents.createdAt)],
    columns: { createdAt: true },
  });
  return row?.createdAt ?? null;
};

export const recordJuegosOpened = async (userId: string, entry: JuegosEntry | null, now = new Date()) => {
  await db.insert(pickEvents).values({
    id: createId(),
    userId,
    titleId: null,
    catalogId: null,
    kind: JUEGOS_OPENED_KIND,
    lens: entry,
    createdAt: now,
  });
};

/** Hoy's «nuevo» dot: a launch or a new tanda since the last visit to the portada. */
export const loadJuegosNovedad = async (userId: string, now = new Date(), juegos: readonly Juego[] = JUEGOS) =>
  juegosNovedad({ lastOpenedAt: await lastJuegosOpenedAt(userId), now, juegos });

export type JuegoTile = {
  id: string;
  name: string;
  href: string;
  /** Small line over the name: «Nueva esta semana», «Llevas 4 de 10». */
  eyebrow: string;
  line: string;
  /** 0–1, the meter under the card. */
  progress: number;
  /** Up to three posters of the week's cards (none before the first deal). */
  posters: string[];
};

/** Up to two cards for Hoy's second act: the seasonal game, then La tanda. Database only. */
export const loadJuegosTiles = async (userId: string, now = new Date(), juegos: readonly Juego[] = JUEGOS): Promise<JuegoTile[]> => {
  const portada = portadaOf(juegos, mxToday(now));
  const tiles: JuegoTile[] = [];
  if (portada.seasonal?.href) {
    tiles.push({
      id: portada.seasonal.id,
      name: portada.seasonal.name,
      href: portada.seasonal.href,
      eyebrow: "De temporada",
      line: portada.seasonal.line,
      progress: 0,
      posters: [],
    });
  }
  const tanda = portada.playable.find((juego) => juego.id === TANDA_ID);
  if (tanda?.href) {
    const state = await readTanda(userId, now);
    const dealt = state.cards.length;
    const answered = state.cards.filter((card) => card.answer).length;
    const seen = state.cards.filter((card) => card.answer && isSeenAnswer(card.answer)).length;
    tiles.push({
      id: tanda.id,
      name: tanda.name,
      href: tanda.href,
      eyebrow:
        dealt > 0 && answered >= dealt
          ? seen === 0
            ? "Terminada esta semana"
            : `Viste ${seen} de ${dealt}`
          : answered > 0
            ? `Llevas ${answered} de ${dealt}`
            : "Nueva esta semana",
      line: `Las que todos vimos, ${state.epoch}.`,
      progress: dealt > 0 ? answered / dealt : 0,
      posters: state.cards.flatMap((card) => (card.posterPath ? [card.posterPath] : [])).slice(0, 3),
    });
  }
  return tiles.slice(0, 2);
};
