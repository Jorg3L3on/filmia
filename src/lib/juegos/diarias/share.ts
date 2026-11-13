import { DIARIA_LENS, isDiariaId, type DiariaId } from "@/lib/juegos/diarias/core";
import { gridState, parseGridAnswers } from "@/lib/juegos/diarias/cuadricula";
import { DETALLE_MAX, detalleState, parseDetalleAnswers, type DetalleRound } from "@/lib/juegos/diarias/detalle";
import { LINEA_CARDS, lineaState, parseLineaAnswers, type LineaRound } from "@/lib/juegos/diarias/linea";
import { parseRepartoAnswers, REPARTO_TRIES, repartoState } from "@/lib/juegos/diarias/reparto";
import { readPartida, type PartidaRow } from "@/lib/juegos/partidas";

/** A square of the shared image: right, half right (Detalle's late guesses), wrong, unused. */
export type ShareTone = "ok" | "mid" | "no" | "none";

export type ShareableDiaria = { id: DiariaId; day: string; score: number; total: number; rows: ShareTone[][] };

const tonesOf = (id: DiariaId, partida: PartidaRow): { score: number; total: number; rows: ShareTone[][] } => {
  const answers = partida.answers as unknown[];
  if (id === "detalle") {
    const round = partida.content as DetalleRound;
    const state = detalleState(parseDetalleAnswers(answers), round.posters.length);
    return {
      score: state.score,
      total: DETALLE_MAX,
      rows: [state.posters.map((poster) => (poster.status === "solved" ? (poster.level <= 2 ? "ok" : "mid") : poster.status === "failed" ? "no" : "none"))],
    };
  }
  if (id === "linea") {
    const state = lineaState(partida.content as LineaRound, parseLineaAnswers(answers));
    const tones = Array.from({ length: LINEA_CARDS }, (_, index): ShareTone => (state.marks[index] == null ? "none" : state.marks[index] ? "ok" : "no"));
    return { score: state.score, total: LINEA_CARDS, rows: [tones.slice(0, 4), tones.slice(4)] };
  }
  if (id === "reparto") {
    const state = repartoState(parseRepartoAnswers(answers));
    return {
      score: state.score,
      total: REPARTO_TRIES,
      rows: [Array.from({ length: REPARTO_TRIES }, (_, index): ShareTone => (state.marks[index] == null ? "none" : state.marks[index] ? "ok" : "no"))],
    };
  }
  const state = gridState(parseGridAnswers(answers));
  return { score: state.score, total: 9, rows: [0, 1, 2].map((row) => [0, 1, 2].map((col): ShareTone => (state.filled.has(row * 3 + col) ? "ok" : "none"))) };
};

/** The person's own finished daily of a FIL-I54 game, for the shared image: numbers and squares, never films. */
export const readShareableDiaria = async (userId: string, partidaId: string): Promise<ShareableDiaria | null> => {
  const partida = await readPartida(userId, partidaId);
  if (!partida || !isDiariaId(partida.juego) || partida.mode !== "diaria" || partida.lens !== DIARIA_LENS || !partida.finishedAt || !partida.day) return null;
  return { id: partida.juego, day: partida.day, ...tonesOf(partida.juego, partida) };
};
