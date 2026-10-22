import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cinemaPayloadsForUser,
  MAX_CINEMA_PUSHES_PER_USER,
  premiereDayLabel,
  premiereWeekdayLabel,
  selectCinemaArrivals,
  type CinemaAlertCandidate,
} from "./cine-alerts";

const TODAY = "2026-10-17";

const candidate = (overrides: Partial<CinemaAlertCandidate> = {}): CinemaAlertCandidate => ({
  userId: "u1",
  titleId: "t1",
  catalogId: "c1",
  name: "La venganza del Charro Negro",
  mxReleaseDate: "2026-10-22",
  status: "upcoming",
  watched: false,
  alerted: false,
  ...overrides,
});

describe("selectCinemaArrivals", () => {
  it("keeps an unseen Quiero ver film premiering within the week", () => {
    assert.deepEqual(selectCinemaArrivals([candidate()], TODAY).map((a) => a.catalogId), ["c1"]);
  });

  it("includes today and the seventh day, not the eighth or the past", () => {
    const picked = selectCinemaArrivals(
      [
        candidate({ catalogId: "today", mxReleaseDate: "2026-10-17", status: "now" }),
        candidate({ catalogId: "day7", mxReleaseDate: "2026-10-24" }),
        candidate({ catalogId: "day8", mxReleaseDate: "2026-10-25" }),
        candidate({ catalogId: "past", mxReleaseDate: "2026-10-16", status: "now" }),
      ],
      TODAY,
    );
    assert.deepEqual(picked.map((a) => a.catalogId), ["today", "day7"]);
  });

  it("skips what was already announced for that date, watched or gone", () => {
    const picked = selectCinemaArrivals(
      [
        candidate({ catalogId: "alerted", alerted: true }),
        candidate({ catalogId: "watched", watched: true }),
        candidate({ catalogId: "gone", status: "gone" }),
      ],
      TODAY,
    );
    assert.deepEqual(picked, []);
  });

  it("announces each film once per user", () => {
    const picked = selectCinemaArrivals([candidate(), candidate({ titleId: "t1-dup" })], TODAY);
    assert.equal(picked.length, 1);
  });
});

describe("cinema push payloads", () => {
  it("says the day and opens the ficha", () => {
    const [payload] = cinemaPayloadsForUser(selectCinemaArrivals([candidate()], TODAY), TODAY);
    assert.equal(payload?.title, "Llega a cines");
    assert.equal(payload?.body, "«La venganza del Charro Negro», de tu Quiero ver, se estrena el jue 22 oct.");
    assert.equal(payload?.url, "/titulos/t1");
    assert.equal(premiereDayLabel(TODAY, TODAY), "hoy");
  });

  it("sends one summary past the cap", () => {
    const many = Array.from({ length: MAX_CINEMA_PUSHES_PER_USER + 1 }, (_, i) =>
      candidate({ catalogId: `c${i}`, titleId: `t${i}`, name: `Película ${i}` }),
    );
    const payloads = cinemaPayloadsForUser(selectCinemaArrivals(many, TODAY), TODAY);
    assert.equal(payloads.length, 1);
    assert.equal(payloads[0]?.url, "/cine/proximamente");
    assert.match(payloads[0]?.title ?? "", /^4 de Quiero ver/);
  });
});

describe("premiereWeekdayLabel", () => {
  it("says hoy, mañana or the weekday", () => {
    assert.equal(premiereWeekdayLabel("2026-10-17", TODAY), "hoy");
    assert.equal(premiereWeekdayLabel("2026-10-18", TODAY), "mañana");
    assert.equal(premiereWeekdayLabel("2026-10-22", TODAY), "el jueves");
  });
});
