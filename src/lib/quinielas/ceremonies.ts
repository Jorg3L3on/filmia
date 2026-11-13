/**
 * Quinielas de premios (FIL-I51-7): the ceremonies the app knows. A new ceremony is one file in
 * `src/data/quinielas/` plus its import here; the validator test fails if a file is left out.
 *
 * Not `server-only`, so the DB tests can load it under tsx; each file is ~20 KB.
 */
import { mxToday } from "@/lib/cine-core";
import oscar2024 from "@/data/quinielas/oscar-2024.json";
import emmyFixture from "../../../scripts/fixtures/quinielas/emmy-2099.json";
import { ceremonyWindow, type QuinielaCeremonyFile } from "@/lib/quinielas/ceremony-core";

const FILES = [oscar2024 as QuinielaCeremonyFile];

const CEREMONIES: Record<string, QuinielaCeremonyFile> = {};
for (const file of FILES) {
  CEREMONIES[file.id] = file;
}

/**
 * Local only: `QUINIELA_FIXTURES=1` adds a made-up Emmy ceremony (series and people in series) to
 * try the screens with TV nominees and two ceremonies open at once. Never in production.
 */
if (process.env.NODE_ENV !== "production" && process.env.QUINIELA_FIXTURES === "1") {
  const fixture = emmyFixture as QuinielaCeremonyFile;
  CEREMONIES[fixture.id] = fixture;
}

/** Tests only: a copy of a known ceremony under another id, so DB suites never share rows. */
export const registerCeremonyForTests = (id: string, from = "oscar-2024", patch: Partial<QuinielaCeremonyFile> = {}) => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("registerCeremonyForTests is for tests");
  }
  CEREMONIES[id] = { ...CEREMONIES[from]!, ...patch, id };
  return CEREMONIES[id]!;
};

export const getCeremony = (id: unknown): QuinielaCeremonyFile | null =>
  typeof id === "string" && Object.hasOwn(CEREMONIES, id) ? CEREMONIES[id]! : null;

/** Every known ceremony, the most recent first. */
export const listCeremonies = () =>
  Object.values(CEREMONIES).sort((a, b) => b.ceremonyOn.localeCompare(a.ceremonyOn) || a.id.localeCompare(b.id));

/** The ids of the files this registry imports (the validator test compares them with the folder). */
export const registeredCeremonyFiles = () => FILES.map((file) => file.id);

/**
 * Today (`YYYY-MM-DD`, Mexico City) for the quinielas. `QUINIELA_HOY` moves it on a local database
 * to rehearse with a past ceremony; it is ignored in production.
 */
export const quinielaToday = (now = new Date(), raw: string | undefined = process.env.QUINIELA_HOY) =>
  process.env.NODE_ENV !== "production" && raw && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? raw.trim() : mxToday(now);

/** The ceremonies whose quiniela is in season on `today`: nominations out, results a week after. */
export const ceremoniesInSeason = (today: string, ceremonies = listCeremonies()) =>
  ceremonies.filter((file) => {
    const window = ceremonyWindow(file);
    return window.from <= today && today <= window.to;
  });

/** Every season window, for the Extras cartel (FIL-I51-8). */
export const quinielaSeasons = (ceremonies = listCeremonies()) => ceremonies.map(ceremonyWindow);
