import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { OSCAR_DATA_SHA } from "@/lib/oscars-core";
import { AWARDS, ceremonyIdOf, parseCeremonyId, type AwardId } from "@/lib/quinielas/awards";
import {
  ballotPhase,
  buildOscarCeremony,
  ceremonyWindow,
  findNominee,
  nomineeDetail,
  nomineeName,
  oscarCeremonyFor,
  scoreBallot,
  skeletonCeremony,
  validateCeremonyFile,
  type QuinielaCeremonyFile,
} from "@/lib/quinielas/ceremony-core";
import { getCeremony, listCeremonies, registeredCeremonyFiles } from "@/lib/quinielas/ceremonies";
import { QUINIELA_SEASON_DATES } from "@/lib/quinielas/seasons";

// Real public rows of DLu/oscar_data @ c5e9716: every row of the 96th ceremony (2024).
const tsv = readFileSync(new URL("../../../scripts/fixtures/oscars-2024.tsv", import.meta.url), "utf8");
const source = { repo: "DLu/oscar_data", sha: OSCAR_DATA_SHA, builtAt: "2026-11-12" };
const dates = { nominationsOn: "2024-01-23", ceremonyOn: "2024-03-10" };
const built = buildOscarCeremony(tsv, { year: 2024, ...dates, source });

describe("quinielas/oscar builder (FIL-I51-1, v2 in FIL-I51-7)", () => {
  it("builds the 2024 ceremony with its 23 categories, in ballot order", () => {
    assert.equal(built.id, "oscar-2024");
    assert.equal(built.award, "oscar");
    assert.equal(built.edition, 96);
    assert.equal(built.year, 2024);
    assert.equal(built.categories.length, 23);
    assert.deepEqual(
      built.categories.slice(0, 6).map((category) => category.id),
      ["pelicula", "direccion", "actriz", "actor", "actriz-reparto", "actor-reparto"],
    );
    assert.deepEqual(validateCeremonyFile(built), []);
  });

  it("keeps every nominee: 10 for Best Picture, 5 elsewhere, all films", () => {
    const counts = Object.fromEntries(built.categories.map((category) => [category.id, category.nominees.length]));
    assert.equal(counts.pelicula, 10);
    for (const [id, count] of Object.entries(counts)) {
      if (id !== "pelicula") assert.equal(count, 5, id);
    }
    assert.ok(built.categories.every((category) => category.nominees.every((nominee) => nominee.work.kind === "movie")));
  });

  it("people, songs and countries read the way the ballot shows them", () => {
    const actress = findNominee(built, "actriz", "nm1297015");
    assert.ok(actress);
    assert.equal(nomineeName(actress), "Emma Stone");
    assert.equal(nomineeDetail(actress), "Poor Things");
    const songs = built.categories.find((category) => category.id === "cancion")!;
    assert.deepEqual(
      songs.nominees.filter((nominee) => nominee.work.imdbId === "tt1517268").map(nomineeName),
      ["«I'm Just Ken»", "«What Was I Made For?»"],
    );
    const zone = findNominee(built, "internacional", "tt7160372");
    assert.equal(zone && nomineeDetail(zone), "United Kingdom");
  });

  it("prefers the Mexican title, unless TMDB answered in another script", () => {
    const base = { id: "x", work: { title: "Poor Things", kind: "movie" as const, imdbId: "tt14230458", titleEs: "Pobres criaturas" } };
    assert.equal(nomineeName(base), "Pobres criaturas");
    assert.equal(nomineeName({ ...base, work: { ...base.work, title: "Letter to a Pig", titleEs: "מכתב לחזיר" } }), "Letter to a Pig");
  });

  it("the committed oscar-2024 file is what the builder makes from the fixture", () => {
    const strip = (file: QuinielaCeremonyFile) => JSON.parse(JSON.stringify({ ...file, source: null })) as unknown;
    assert.deepEqual(strip(getCeremony("oscar-2024")!), strip(built));
  });

  it("fails loudly for a ceremony that is not in the dataset", () => {
    assert.throws(() => buildOscarCeremony(tsv, { year: 2027, ...dates, source }), /ceremony 99 \(2027\)/);
    assert.equal(oscarCeremonyFor(2027), 99);
  });
});

describe("quinielas/files (FIL-I51-7)", () => {
  const folder = new URL("../../data/quinielas/", import.meta.url);
  const files = readdirSync(folder).filter((name) => name.endsWith(".json"));

  it("every committed file passes the validator and is registered", () => {
    assert.ok(files.length > 0);
    for (const name of files) {
      const file = JSON.parse(readFileSync(new URL(name, folder), "utf8")) as QuinielaCeremonyFile;
      assert.deepEqual(validateCeremonyFile(file), [], name);
      assert.equal(`${file.id}.json`, name);
    }
    assert.deepEqual(registeredCeremonyFiles().sort(), files.map((name) => name.replace(/\.json$/, "")).sort());
  });

  it("the Extras season dates match the ceremony files", () => {
    assert.deepEqual(
      [...QUINIELA_SEASON_DATES].sort((a, b) => a.id.localeCompare(b.id)),
      listCeremonies()
        .map(({ id, nominationsOn, ceremonyOn }) => ({ id, nominationsOn, ceremonyOn }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
  });

  it("a broken file is refused with reasons", () => {
    const broken = {
      ...built,
      id: "oscar-2023",
      nominationsOn: "2024-03-11",
      categories: [
        { ...built.categories[0]!, nominees: built.categories[0]!.nominees.slice(0, 1) },
        { ...built.categories[1]!, nominees: [built.categories[1]!.nominees[0]!, built.categories[1]!.nominees[0]!] },
        { id: "inventada", label: "x", short: "x", kind: "film", nominees: [] },
      ],
    };
    const errors = validateCeremonyFile(broken).join(" | ");
    assert.match(errors, /no corresponde/);
    assert.match(errors, /antes de la ceremonia/);
    assert.match(errors, /pelicula: necesita al menos 2/);
    assert.match(errors, /direccion \/ nm\d+: repetida/);
    assert.match(errors, /inventada: no está en la plantilla/);
    assert.deepEqual(validateCeremonyFile(null), ["no es un objeto"]);
  });

  it("a series category needs TV works and people need a name", () => {
    const emmy = skeletonCeremony({ award: "emmy", year: 2126, nominationsOn: "2126-07-15", ceremonyOn: "2126-09-14", builtAt: "x" });
    emmy.categories = emmy.categories.slice(0, 1).map((category) => ({
      ...category,
      nominees: [
        { id: "a", work: { title: "A", kind: "movie" as const, imdbId: null } },
        { id: "b", work: { title: "B", kind: "tv" as const, imdbId: null } },
      ],
    }));
    assert.deepEqual(validateCeremonyFile(emmy), ["categoría serie-drama / a: una serie debe ser tv"]);
  });

  it("every award's skeleton is valid as an empty skeleton", () => {
    for (const award of Object.keys(AWARDS) as AwardId[]) {
      const file = skeletonCeremony({ award, year: 2027, nominationsOn: "2027-01-01", ceremonyOn: "2027-02-01", builtAt: "x" });
      assert.deepEqual(validateCeremonyFile(file, { allowEmpty: true }), [], award);
      assert.equal(file.id, ceremonyIdOf(award, 2027));
      assert.ok(validateCeremonyFile(file).length > 0, `${award}: an empty ballot is not playable`);
    }
  });

  it("ceremony ids parse only for known awards", () => {
    assert.deepEqual(parseCeremonyId("emmy-2026"), { award: "emmy", year: 2026 });
    assert.equal(parseCeremonyId("grammy-2026"), null);
    assert.equal(parseCeremonyId("../oscar-2024"), null);
  });

  it("a ceremony is in season from its nominations to a week after it", () => {
    assert.deepEqual(ceremonyWindow({ nominationsOn: "2027-01-21", ceremonyOn: "2027-03-14" }), { from: "2027-01-21", to: "2027-03-21" });
  });
});

describe("quinielas/ballot phase", () => {
  const now = new Date("2027-03-14T23:00:00Z");
  it("is «pronto» without a ceremony or closing time", () => {
    assert.equal(ballotPhase({ hasCeremony: false, closesAt: null, now }), "pronto");
    assert.equal(ballotPhase({ hasCeremony: true, closesAt: null, now }), "pronto");
  });
  it("is open until the closing time and closed from it on", () => {
    assert.equal(ballotPhase({ hasCeremony: true, closesAt: new Date("2027-03-14T23:00:01Z"), now }), "abierta");
    assert.equal(ballotPhase({ hasCeremony: true, closesAt: now, now }), "cerrada");
  });
});

describe("quinielas/score (FIL-I51-1)", () => {
  const ids = built.categories.map((category) => category.id);
  const votes = { pelicula: "tt15398776", direccion: "nm0634240", actriz: "nm4291409", actor: "nm0614165" };

  it("counts nothing before any winner", () => {
    const score = scoreBallot(ids, votes, {});
    assert.deepEqual([score.hits, score.announced, score.total, score.remaining, score.voted], [0, 0, 23, 23, 4]);
    assert.ok(score.results.every((result) => result.hit === null));
  });

  it("partial winners: hits, misses and categories still open", () => {
    const score = scoreBallot(ids, votes, { actriz: "nm1297015", direccion: "nm0634240", fotografia: "tt15398776" });
    assert.deepEqual([score.hits, score.announced, score.remaining], [1, 3, 20]);
    const byId = Object.fromEntries(score.results.map((result) => [result.categoryId, result]));
    assert.equal(byId.actriz?.hit, false);
    assert.equal(byId.direccion?.hit, true);
    assert.equal(byId.pelicula?.hit, null);
  });

  it("complete winners: the final score", () => {
    const winners = Object.fromEntries(built.categories.map((category) => [category.id, category.nominees[0]!.id]));
    assert.deepEqual(
      (({ hits, announced, remaining }) => [hits, announced, remaining])(scoreBallot(ids, winners, winners)),
      [23, 23, 0],
    );
    assert.equal(scoreBallot(ids, { ...winners, pelicula: "tt15398776" }, winners).hits, 22);
  });

  it("ignores votes and winners for categories the ceremony does not have", () => {
    const score = scoreBallot(["pelicula"], { pelicula: "a", inventada: "b" }, { pelicula: "a", inventada: "b" });
    assert.deepEqual([score.hits, score.total, score.voted], [1, 1, 1]);
  });
});
