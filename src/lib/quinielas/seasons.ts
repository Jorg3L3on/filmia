/**
 * Quinielas de premios (FIL-I51-8): only the dates of each ceremony, for the Extras cartel. It is
 * client-safe and tiny on purpose: `@/lib/juegos/core` reaches client components and must not pull
 * in the ceremony files. A test checks this list against `src/data/quinielas/`.
 */
export type QuinielaSeasonDates = { id: string; nominationsOn: string; ceremonyOn: string };

export const QUINIELA_SEASON_DATES: readonly QuinielaSeasonDates[] = [
  { id: "oscar-2024", nominationsOn: "2024-01-23", ceremonyOn: "2024-03-10" },
];
