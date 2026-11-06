import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OscarWin, PersonOscarRecord } from "@/lib/oscars-core";
import {
  OSCAR_FIND_MAX,
  oscarNominationsLine,
  oscarRowMeta,
  oscarsHeader,
  resolvePersonOscars,
  visibleOscarRows,
  type FoundMovie,
  type PersonOscarRow,
} from "@/lib/person-oscars";

const win = (ceremony: number, film: { title: string; imdbId: string | null } | null, categoryEs = "Mejor fotografía"): OscarWin => ({
  ceremony,
  year: 1928 + ceremony,
  category: film ? "CINEMATOGRAPHY" : "IRVING G. THALBERG MEMORIAL AWARD",
  categoryEs: film ? categoryEs : "Premio Irving G. Thalberg",
  film,
});

const deakins: PersonOscarRecord = {
  wins: [win(92, { title: "1917", imdbId: "tt8579674" }), win(90, { title: "Blade Runner 2049", imdbId: "tt1856101" })],
  nominations: 16,
};

const tmdb: Record<string, FoundMovie> = {
  tt8579674: { tmdbId: 530915, title: "1917", posterPath: "/1917.jpg" },
  tt1856101: { tmdbId: 335984, title: "Blade Runner 2049", posterPath: "/br.jpg" },
  tt0108052: { tmdbId: 424, title: "La lista de Schindler", posterPath: "/sl.jpg" },
};
const find = async (imdbId: string) => tmdb[imdbId] ?? null;

const rows = (count: number): PersonOscarRow[] =>
  Array.from({ length: count }, (_, index) => ({
    key: String(index),
    year: 2000 - index,
    categoryEs: "Mejor dirección",
    title: `Película ${index}`,
    tmdbId: index,
    posterPath: null,
  }));

describe("person-oscars/resolve", () => {
  it("gives each win its TMDB id, Spanish title and poster", async () => {
    const oscars = await resolvePersonOscars(deakins, find);
    assert.deepEqual(
      oscars?.wins.map((row) => [row.year, row.title, row.tmdbId, row.posterPath, oscarRowMeta(row)]),
      [
        [2020, "1917", 530915, "/1917.jpg", "2020 · Mejor fotografía"],
        [2018, "Blade Runner 2049", 335984, "/br.jpg", "2018 · Mejor fotografía"],
      ],
    );
    assert.equal(oscars?.nominations, 16);
  });

  it("uses the Spanish title when TMDB has one", async () => {
    const oscars = await resolvePersonOscars(
      { wins: [win(66, { title: "Schindler's List", imdbId: "tt0108052" }, "Mejor dirección")], nominations: 1 },
      find,
    );
    assert.equal(oscars?.wins[0]?.title, "La lista de Schindler");
  });

  it("falls back to the English title and no poster when /find fails, without failing the panel", async () => {
    const oscars = await resolvePersonOscars(deakins, async (imdbId) => {
      if (imdbId === "tt8579674") {
        throw new Error("TMDB down");
      }
      return find(imdbId);
    });
    assert.deepEqual(oscars?.wins[0], {
      key: "92:CINEMATOGRAPHY:0",
      year: 2020,
      categoryEs: "Mejor fotografía",
      title: "1917",
      tmdbId: null,
      posterPath: null,
    });
    assert.equal(oscars?.wins[1]?.tmdbId, 335984);
  });

  it("names the award for a win without a film and looks nothing up", async () => {
    let calls = 0;
    const oscars = await resolvePersonOscars({ wins: [win(59, null)], nominations: 1 }, async () => {
      calls += 1;
      return null;
    });
    const row = oscars?.wins[0];
    assert.equal(row?.title, null);
    assert.equal(row && oscarRowMeta(row), "1987");
    assert.equal(calls, 0);
  });

  it("looks up the 12 newest wins only, once per film", async () => {
    const seen: string[] = [];
    const many: PersonOscarRecord = {
      wins: Array.from({ length: 15 }, (_, index) => win(90 - index, { title: `F${index}`, imdbId: `tt${100 + Math.floor(index / 2)}` })),
      nominations: 30,
    };
    const oscars = await resolvePersonOscars(many, async (imdbId) => {
      seen.push(imdbId);
      return { tmdbId: Number(imdbId.slice(2)), title: null, posterPath: null };
    });
    assert.equal(seen.length, OSCAR_FIND_MAX / 2);
    assert.equal(oscars?.wins[OSCAR_FIND_MAX - 1]?.tmdbId, 105);
    assert.equal(oscars?.wins[OSCAR_FIND_MAX]?.tmdbId, null);
    // A found movie without a Spanish title keeps the dataset's.
    assert.equal(oscars?.wins[0]?.title, "F0");
  });

  it("is null for no record and keeps nominations-only people", async () => {
    assert.equal(await resolvePersonOscars(null, find), null);
    assert.deepEqual(await resolvePersonOscars({ wins: [], nominations: 8 }, find), { wins: [], nominations: 8 });
  });
});

describe("person-oscars/labels", () => {
  it("header: invariant «Óscar», nominations only when more than the wins", () => {
    assert.deepEqual(oscarsHeader({ wins: rows(2), nominations: 16 }), { wins: "2 Óscar", nominations: "16 nominaciones" });
    assert.deepEqual(oscarsHeader({ wins: rows(1), nominations: 1 }), { wins: "1 Óscar", nominations: null });
  });

  it("nominations-only line", () => {
    assert.equal(oscarNominationsLine(8), "8 nominaciones al Óscar");
    assert.equal(oscarNominationsLine(1), "1 nominación al Óscar");
  });

  it("shows 4 rows, then «Ver los N»", () => {
    assert.deepEqual(visibleOscarRows(rows(4), false), { rows: rows(4), more: null });
    const collapsed = visibleOscarRows(rows(6), false);
    assert.equal(collapsed.rows.length, 4);
    assert.equal(collapsed.more, "Ver los 6");
    assert.deepEqual(visibleOscarRows(rows(6), true), { rows: rows(6), more: null });
  });
});
