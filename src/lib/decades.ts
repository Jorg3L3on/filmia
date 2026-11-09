/**
 * «Explora por década» on Buscar (FIL-I46-4): your library grouped by the decade of each title's
 * year. Pure; the server only reads id, name, poster and year.
 */
export type DecadeTitle = { id: string; name: string; posterPath: string | null; year: number | null };

export type DecadeShelf = { decade: number; label: string; titles: DecadeTitle[] };

export const decadeOf = (year: number) => Math.floor(year / 10) * 10;

/** «90s» for the 1990s, «2020s» from 2000 on (two digits would read «00s», «20s»). */
export const decadeLabel = (decade: number) => (decade >= 2000 ? `${decade}s` : `${String(decade).slice(2)}s`);

/** Newest decade first; within one, newest year first, then by name. Titles without a year are left out. */
export const groupByDecade = (titles: readonly DecadeTitle[]): DecadeShelf[] => {
  const byDecade = new Map<number, DecadeTitle[]>();
  for (const title of titles) {
    if (title.year == null || !Number.isFinite(title.year) || title.year < 1870) continue;
    const decade = decadeOf(title.year);
    byDecade.set(decade, [...(byDecade.get(decade) ?? []), title]);
  }
  return [...byDecade.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([decade, items]) => ({
      decade,
      label: decadeLabel(decade),
      titles: [...items].sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.name.localeCompare(b.name, "es")),
    }));
};
