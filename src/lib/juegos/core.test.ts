import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  JUEGOS,
  juegosNovedad,
  latestLaunchOn,
  mxDayStart,
  parseJuegosEntry,
  portadaOf,
  weekKeyOf,
  type Juego,
} from "@/lib/juegos/core";
import { LAUNCH_PUSH_DAYS } from "@/lib/juegos/push";
import { isJuegoPlayPath, isJuegosPath, isMobileNavCurrent, mobileNavItems, desktopNavItems } from "@/lib/nav";

const juego = (overrides: Partial<Juego>): Juego => ({
  id: "x",
  name: "X",
  line: "",
  status: "available",
  href: "/extras/x",
  launchedOn: "2026-11-12",
  seasons: null,
  ...overrides,
});

describe("Juegos cartel (FIL-I50-2)", () => {
  it("La tanda, Duelos and Mayor o menor are playable; the rest, quinielas included, in «Próximamente» off season", () => {
    const portada = portadaOf(JUEGOS, "2026-11-20");
    assert.equal(portada.seasonal, null);
    assert.deepEqual(
      portada.playable.map((item) => item.id),
      ["tanda", "duelos", "mayor"],
    );
    assert.deepEqual(
      portada.soon.map((item) => item.id),
      ["quiniela", "muro", "detalle", "linea", "reparto", "cuadricula", "estrenos", "bingo", "liga"],
    );
  });

  it("FIL-I55: the quiniela, the bingo and the liga launch a week apart, each with its own push week", () => {
    const launches = JUEGOS.filter((item) => item.launchedOn).map((item) => ({ id: item.id, on: item.launchedOn! }));
    for (const id of ["estrenos", "bingo", "liga"]) {
      const mine = launches.find((launch) => launch.id === id);
      assert.ok(mine, `${id} has a launch date`);
      for (const other of launches) {
        if (other.id === id) continue;
        const gap = Math.abs(Date.parse(mine.on) - Date.parse(other.on)) / 86_400_000;
        assert.ok(gap >= LAUNCH_PUSH_DAYS, `${id} (${mine.on}) and ${other.id} (${other.on}) are ${gap} days apart`);
      }
    }
    // FIL-I54's diarias (not on this branch) launch on Mondays up to 2026-12-14; ours start after its push week.
    assert.ok(launches.filter((launch) => ["estrenos", "bingo", "liga"].includes(launch.id)).every((launch) => launch.on >= "2026-12-21"));
    assert.deepEqual(portadaOf(JUEGOS, "2027-01-11").playable.slice(-3).map((item) => item.id), ["estrenos", "bingo", "liga"]);
  });

  it("Mayor o menor launches on its day with its own route (FIL-I52-6)", () => {
    const mayor = JUEGOS.find((item) => item.id === "mayor");
    assert.equal(mayor?.status, "available");
    assert.equal(mayor?.href, "/extras/mayor-o-menor");
    assert.equal(mayor?.launchedOn, "2026-11-13");
    assert.deepEqual(portadaOf(JUEGOS, "2026-11-12").playable.map((item) => item.id), ["tanda", "duelos"]);
    assert.ok(portadaOf(JUEGOS, "2026-11-12").soon.some((item) => item.id === "mayor"));
  });

  it("Duelos is available without a launch date: no launch push, no «nuevo» dot (FIL-I53-7)", () => {
    const duelos = JUEGOS.find((item) => item.id === "duelos");
    assert.equal(duelos?.status, "available");
    assert.equal(duelos?.href, "/extras/duelos");
    assert.equal(duelos?.launchedOn, null);
  });

  it("the quinielas are on top inside any ceremony's window, without a launch (no push, no dot) (FIL-I51-8)", () => {
    const quiniela = JUEGOS.find((item) => item.id === "quiniela");
    assert.equal(quiniela?.href, "/extras/quinielas");
    assert.equal(quiniela?.status, "seasonal");
    assert.equal(quiniela?.launchedOn, null);
    // The 2024 rehearsal ceremony: nominations 2024-01-23, night 2024-03-10, results a week more.
    assert.equal(portadaOf(JUEGOS, "2024-02-01").seasonal?.id, "quiniela");
    assert.equal(portadaOf(JUEGOS, "2024-03-17").seasonal?.id, "quiniela");
    assert.equal(portadaOf(JUEGOS, "2024-03-18").seasonal, null);
    assert.equal(latestLaunchOn(JUEGOS, "2026-11-20"), "2026-11-13");
  });

  it("a seasonal game with several windows is on top in each of them and not between", () => {
    const multi = juego({
      id: "multi",
      status: "seasonal",
      seasons: [
        { from: "2026-12-07", to: "2027-01-17" },
        { from: "2027-01-19", to: "2027-03-21" },
        { from: "2027-07-14", to: "2027-09-26" },
      ],
    });
    for (const day of ["2026-12-07", "2027-01-17", "2027-02-20", "2027-08-01"]) {
      assert.equal(portadaOf([multi], day).seasonal?.id, "multi", day);
    }
    for (const day of ["2026-12-06", "2027-01-18", "2027-05-01"]) {
      assert.equal(portadaOf([multi], day).seasonal, null, day);
    }
  });

  it("puts a seasonal game on top only inside its window", () => {
    const oscar = juego({ id: "oscar", status: "seasonal", seasons: [{ from: "2027-01-22", to: "2027-03-14" }], launchedOn: "2027-01-22" });
    assert.equal(portadaOf([oscar], "2027-02-01").seasonal?.id, "oscar");
    assert.equal(portadaOf([oscar], "2027-04-01").seasonal, null);
    assert.deepEqual(
      portadaOf([oscar], "2027-04-01").soon.map((item) => item.id),
      ["oscar"],
    );
  });

  it("a game launching later is «Próximamente» until its day", () => {
    const later = juego({ id: "muro", launchedOn: "2026-12-07" });
    assert.deepEqual(portadaOf([later], "2026-12-06").playable, []);
    assert.equal(portadaOf([later], "2026-12-07").playable[0]?.id, "muro");
    assert.equal(latestLaunchOn([later], "2026-12-06"), null);
  });
});

describe("Juegos' «nuevo» dot (FIL-I50-2)", () => {
  const tanda = juego({ id: "tanda", launchedOn: "2026-11-12" });
  // Thursday 2026-11-19, 14:00 in Mexico City.
  const now = new Date("2026-11-19T20:00:00Z");

  it("is on until the portada is opened, then off", () => {
    assert.equal(juegosNovedad({ lastOpenedAt: null, now, juegos: [tanda] }), true);
    assert.equal(juegosNovedad({ lastOpenedAt: new Date("2026-11-18T15:00:00Z"), now, juegos: [tanda] }), false);
  });

  it("comes back with Monday's new tanda", () => {
    // Opened on Saturday the 14th: before this week's Monday (the 16th).
    assert.equal(juegosNovedad({ lastOpenedAt: new Date("2026-11-14T18:00:00Z"), now, juegos: [tanda] }), true);
  });

  it("comes back with a new launch", () => {
    const muro = juego({ id: "muro", launchedOn: "2026-11-19" });
    const openedTuesday = new Date("2026-11-17T18:00:00Z");
    assert.equal(juegosNovedad({ lastOpenedAt: openedTuesday, now, juegos: [tanda] }), false);
    assert.equal(juegosNovedad({ lastOpenedAt: openedTuesday, now, juegos: [tanda, muro] }), true);
  });

  it("is off before anything has launched", () => {
    assert.equal(juegosNovedad({ lastOpenedAt: null, now, juegos: [juego({ launchedOn: "2027-01-01" })] }), false);
  });
});

describe("La tanda's week", () => {
  it("turns on Monday in Mexico City", () => {
    assert.equal(weekKeyOf(new Date("2026-11-16T05:59:00Z")), "2026-11-09"); // Sunday 23:59 CDMX
    assert.equal(weekKeyOf(new Date("2026-11-16T06:00:00Z")), "2026-11-16"); // Monday 00:00 CDMX
    assert.equal(weekKeyOf(new Date("2026-11-22T20:00:00Z")), "2026-11-16"); // Sunday afternoon
    assert.equal(mxDayStart("2026-11-16").toISOString(), "2026-11-16T06:00:00.000Z");
  });

  it("knows the two doors and nothing else", () => {
    assert.equal(parseJuegosEntry("boton"), "boton");
    assert.equal(parseJuegosEntry("bloque"), "bloque");
    assert.equal(parseJuegosEntry("dock"), null);
  });
});

describe("Juegos in the navigation", () => {
  it("lights Hoy, hides the dock only while playing", () => {
    assert.equal(isJuegosPath("/extras"), true);
    assert.equal(isJuegosPath("/extras/tanda"), true);
    assert.equal(isJuegosPath("/extrasx"), false);
    assert.equal(isJuegoPlayPath("/extras"), false);
    assert.equal(isJuegoPlayPath("/extras/tanda"), true);
    // FIL-I53-4: the public reto link plays without the dock too.
    assert.equal(isJuegoPlayPath("/reto/abc"), true);
    assert.equal(isMobileNavCurrent("/", "/extras"), true);
    assert.equal(isMobileNavCurrent("/", "/extras/tanda?x=1"), true);
    assert.equal(isMobileNavCurrent("/perfil", "/extras"), false);
  });

  it("has no Juegos entry in the dock or the desktop header", () => {
    assert.ok(!mobileNavItems.some((item) => item.href.startsWith("/extras")));
    assert.ok(!desktopNavItems.some((item) => item.href.startsWith("/extras")));
  });
});
