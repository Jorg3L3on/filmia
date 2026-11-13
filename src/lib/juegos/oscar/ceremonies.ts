/**
 * Quiniela del Óscar (FIL-I51): the ceremony files the app knows. Add the new year's import here
 * when its file lands (`npm run oscars:build -- --entrega <year>`, or written by hand).
 *
 * Not `server-only`, so the DB tests can load it under tsx; the files are small (~20 KB each).
 */
import ceremony2024 from "@/data/oscar-ceremonies/2024.json";
import type { OscarCeremonyFile } from "@/lib/juegos/oscar/ceremony-core";

const CEREMONIES: Record<number, OscarCeremonyFile> = {
  2024: ceremony2024 as OscarCeremonyFile,
};

/**
 * Tests only: a copy of a known ceremony under a year no one plays, so DB suites that run in
 * parallel never share rows.
 */
export const registerOscarCeremonyForTests = (year: number, from = 2024) => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("registerOscarCeremonyForTests is for tests");
  }
  CEREMONIES[year] = { ...CEREMONIES[from]!, year };
};

/**
 * The ceremony the quiniela plays this season: the 99th, held in 2027. `OSCAR_QUINIELA_YEAR`
 * overrides it on a local database to rehearse with a past ceremony (2024).
 */
export const OSCAR_SEASON_YEAR = 2027;

export const oscarSeasonYear = (raw: string | undefined = process.env.OSCAR_QUINIELA_YEAR) => {
  const year = Number(raw?.trim());
  return Number.isInteger(year) && year > 1928 ? year : OSCAR_SEASON_YEAR;
};

export const getOscarCeremony = (year: number): OscarCeremonyFile | null =>
  Object.hasOwn(CEREMONIES, year) ? CEREMONIES[year]! : null;

export const knownOscarCeremonyYears = () => Object.keys(CEREMONIES).map(Number).sort((a, b) => b - a);
