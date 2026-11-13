import { addDays, mxToday } from "@/lib/cine-core";
import { MAYOR_ID, MAYOR_PATH } from "@/lib/juegos/mayor/core";
import { QUINIELA_SEASON_DATES } from "@/lib/quinielas/seasons";

/**
 * Extras (FIL-I50; «Juegos» in the plan, renamed by Jorge because not everything in it is a game): the section's cartel and its pure rules. A game is listed here in code; the
 * portada and Hoy's two doors read only this. Pure: no database, no TMDB.
 */

export const JUEGOS_PATH = "/extras";

export type JuegoStatus = "available" | "soon" | "seasonal";

export type Juego = {
  id: string;
  name: string;
  /** One line under the name on the portada. */
  line: string;
  status: JuegoStatus;
  /** Where it opens; a game that is only «Pronto» has none. */
  href: string | null;
  /** `YYYY-MM-DD` (Mexico City) it became playable: from then on Hoy shows the «nuevo» dot once. */
  launchedOn: string | null;
  /**
   * A seasonal game is on the portada's top only inside one of these windows (`YYYY-MM-DD`,
   * inclusive); outside them it waits in «Próximamente». Several windows: the quinielas have one
   * per ceremony (FIL-I51-8).
   */
  seasons: readonly { from: string; to: string }[] | null;
};

export const TANDA_ID = "tanda";
export const TANDA_PATH = "/extras/tanda";
export const QUINIELAS_ID = "quiniela";
export const DUELOS_ID = "duelos";
export const QUINIELAS_PATH = "/extras/quinielas";

export const JUEGOS: readonly Juego[] = [
  {
    id: TANDA_ID,
    name: "La tanda",
    line: "Diez cartas: ¿la viste?, ¿te gustó?",
    status: "available",
    href: TANDA_PATH,
    launchedOn: "2026-11-12",
    seasons: null,
  },
  {
    id: QUINIELAS_ID,
    name: "Quinielas de premios",
    line: "Óscar, Globos de Oro, Emmy y BAFTA: predice quién gana y sigue tus aciertos en vivo.",
    // On top while any ceremony is in season (nominations → a week after the night). launchedOn
    // stays null until the first real ceremony opens (FIL-I51-10): setting it sends the launch push.
    status: "seasonal",
    href: QUINIELAS_PATH,
    launchedOn: null,
    seasons: QUINIELA_SEASON_DATES.map((dates) => ({ from: dates.nominationsOn, to: addDays(dates.ceremonyOn, 7) })),
  },
  {
    id: "muro",
    name: "El muro",
    line: "Colecciones: toca las que viste.",
    status: "soon",
    href: null,
    launchedOn: null,
    seasons: null,
  },
  {
    id: DUELOS_ID,
    name: "Duelos",
    line: "Reta a alguien: Mayor o menor, trivia o gustos.",
    status: "available",
    href: "/extras/duelos",
    // FIL-I53-7: null = playable without a launch push or Hoy's «nuevo» dot. Set the deploy day to send them.
    launchedOn: null,
    seasons: null,
  },
  {
    id: "linea",
    name: "Línea de tiempo",
    line: "Ordena cuatro películas por año.",
    status: "soon",
    href: null,
    launchedOn: null,
    seasons: null,
  },
  {
    id: MAYOR_ID,
    name: "Mayor o menor",
    line: "¿Cuál tiene mejor nota? La diaria y tu racha.",
    status: "available",
    href: MAYOR_PATH,
    // FIL-I52-6: setting it sends the launch push once per person (within LAUNCH_PUSH_DAYS).
    launchedOn: "2026-11-13",
    seasons: null,
  },
];

const launched = (juego: Juego, today: string) => juego.href != null && (juego.launchedOn == null || juego.launchedOn <= today);

const inSeason = (juego: Juego, today: string) =>
  juego.status === "seasonal" &&
  (juego.seasons ?? []).some((window) => window.from <= today && today <= window.to) &&
  launched(juego, today);

export type Portada = {
  /** «De temporada»: on top while its window is open. */
  seasonal: Juego | null;
  /** «Para jugar hoy». */
  playable: Juego[];
  /** «Próximamente»: not launched yet, or a seasonal game outside its window. */
  soon: Juego[];
};

/** How the portada lays the cartel out on `today` (`YYYY-MM-DD`, Mexico City). */
export const portadaOf = (juegos: readonly Juego[], today: string): Portada => {
  const seasonal = juegos.find((juego) => inSeason(juego, today)) ?? null;
  const playable = juegos.filter((juego) => juego.status === "available" && launched(juego, today));
  const soon = juegos.filter((juego) => juego !== seasonal && !playable.includes(juego));
  return { seasonal, playable, soon };
};

/** The most recent launch day of a playable game, or null before the first one. */
export const latestLaunchOn = (juegos: readonly Juego[], today: string) =>
  juegos
    .filter((juego) => juego.launchedOn != null && launched(juego, today))
    .map((juego) => juego.launchedOn!)
    .sort()
    .at(-1) ?? null;

/** Monday (`YYYY-MM-DD`) of the Mexico City week `now` falls in: La tanda turns on Monday. */
export const weekKeyOf = (now: Date) => {
  const today = mxToday(now);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDays(today, -((weekday + 6) % 7));
};

/** Mexico City is UTC−6 all year (no DST since 2022): a local day starts at 06:00 UTC. */
export const mxDayStart = (day: string) => new Date(`${day}T06:00:00.000Z`);

/**
 * Hoy's «nuevo» dot: on until the person opens the portada after the latest change, a game's
 * launch or Monday's new tanda. Nothing to show before the first launch.
 */
export const juegosNovedad = (input: { lastOpenedAt: Date | null; now: Date; juegos?: readonly Juego[] }) => {
  const today = mxToday(input.now);
  const launch = latestLaunchOn(input.juegos ?? JUEGOS, today);
  if (!launch) {
    return false;
  }
  const week = weekKeyOf(input.now);
  const since = mxDayStart(launch > week ? launch : week);
  return input.lastOpenedAt == null || input.lastOpenedAt < since;
};

/** Where a visit to the portada came from, for the metrics (FIL-I50-6). */
export const JUEGOS_ENTRIES = ["boton", "bloque"] as const;
export type JuegosEntry = (typeof JUEGOS_ENTRIES)[number];
export const parseJuegosEntry = (value: unknown): JuegosEntry | null =>
  JUEGOS_ENTRIES.includes(value as JuegosEntry) ? (value as JuegosEntry) : null;

/** `PickEvent.kind` of a visit to the portada; `lens` carries the entry. */
export const JUEGOS_OPENED_KIND = "juegos_opened";
