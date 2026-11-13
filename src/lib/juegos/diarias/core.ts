import { MAYOR_MIN_VOTES } from "@/lib/juegos/mayor/core";

/**
 * Las diarias de FIL-I54 (Detalle, Línea de tiempo, Reparto misterioso, La cuadrícula): what they
 * share. Each is one round a day, the same for every account, one attempt, a day table among all
 * accounts and a shareable result, all over the partida engine of FIL-I52 (`partidas.ts`). Pure.
 */

export const DIARIA_IDS = ["detalle", "linea", "reparto", "cuadricula"] as const;
export type DiariaId = (typeof DIARIA_IDS)[number];
export const isDiariaId = (value: unknown): value is DiariaId => DIARIA_IDS.includes(value as DiariaId);

/** The engine's `lens` for these games: they have one variant, the daily. */
export const DIARIA_LENS = "diaria";

/** Well-known films only (decision of 2026-11-13): the same IMDb votes threshold as Mayor o menor. */
export const DIARIA_MIN_VOTES = MAYOR_MIN_VOTES;

/** A round never repeats a film any of the game's rounds of the last this many days used. */
export const DIARIA_NO_REPEAT_DAYS = 60;

export type DiariaDef = {
  id: DiariaId;
  name: string;
  /** The cartel's line on the portada. */
  line: string;
  path: string;
  /**
   * Launch day (Mexico City): the cartel's `launchedOn` (it sends the launch push once) and the
   * day of n.º 1. One a week (FIL-I54-5), so nobody gets two launch pushes close together.
   */
  launchedOn: string;
  /** Best possible score («13 de 18»). */
  total: number;
};

export const DIARIAS: Record<DiariaId, DiariaDef> = {
  detalle: { id: "detalle", name: "Detalle", line: "Un recorte del póster que se abre en seis pasos.", path: "/extras/detalle", launchedOn: "2026-11-23", total: 18 },
  linea: { id: "linea", name: "Línea de tiempo", line: "Ocho películas a su año, con tres vidas.", path: "/extras/linea", launchedOn: "2026-11-30", total: 8 },
  reparto: { id: "reparto", name: "Reparto misterioso", line: "Adivina la película por su reparto.", path: "/extras/reparto", launchedOn: "2026-12-07", total: 6 },
  cuadricula: { id: "cuadricula", name: "La cuadrícula", line: "Tres personas por tres condiciones, nueve intentos.", path: "/extras/cuadricula", launchedOn: "2026-12-14", total: 9 },
};

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** «Detalle n.º 4». */
export const diariaNumber = (id: DiariaId, day: string) => Math.max(1, daysBetween(DIARIAS[id].launchedOn, day) + 1);

/** The seed of the day's round: the same for every account. */
export const diariaSeed = (id: DiariaId, day: string) => `${id}|diaria|${day}`;

/** A title the person picked in the search: what an answer carries. */
export type TitleGuess = { tmdbId: number; name: string };

/** Clean what the client sent as a guess; null when it is not a real TMDB movie id. */
export const parseTitleGuess = (value: unknown): TitleGuess | null => {
  if (!value || typeof value !== "object") return null;
  const tmdbId = Number((value as { tmdbId?: unknown }).tmdbId);
  const name = String((value as { name?: unknown }).name ?? "").trim().slice(0, 120);
  return Number.isInteger(tmdbId) && tmdbId > 0 && name ? { tmdbId, name } : null;
};

/** The shared text: game, number, score and marks. Never a film. */
export const diariaShareText = (input: { id: DiariaId; day: string; score: string; marks: string; url: string }) =>
  [`Filmia · ${DIARIAS[input.id].name} n.º ${diariaNumber(input.id, input.day)}`, input.score, input.marks, input.url]
    .filter(Boolean)
    .join("\n");
