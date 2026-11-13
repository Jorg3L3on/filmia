import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { retoPushLens, retoPushPayload, shouldPushReto } from "@/lib/juegos/push";
import { retosMetrics } from "@/lib/juegos/retos/metrics";
import {
  expiresLine,
  headToHead,
  headToHeadLine,
  isRetoExpired,
  isRetoOpen,
  RETO_MS,
  retoNames,
  retoOutcome,
  suddenDeathTrack,
} from "@/lib/juegos/retos/core";

describe("Retos: pure rules (FIL-I53-1)", () => {
  it("expires exactly 48 hours after it was sent", () => {
    const sent = new Date("2031-01-01T12:00:00Z");
    const reto = { status: "abierto", expiresAt: new Date(sent.getTime() + RETO_MS) };
    assert.equal(isRetoOpen(reto, new Date(sent.getTime() + RETO_MS - 1)), true);
    assert.equal(isRetoExpired(reto, new Date(sent.getTime() + RETO_MS - 1)), false);
    assert.equal(isRetoOpen(reto, new Date(sent.getTime() + RETO_MS)), false);
    assert.equal(isRetoExpired(reto, new Date(sent.getTime() + RETO_MS)), true);
    assert.equal(expiresLine(reto.expiresAt, new Date(sent.getTime() + 17 * 3_600_000)), "Vence en 31 h");
    assert.equal(expiresLine(reto.expiresAt, new Date(sent.getTime() + RETO_MS - 5 * 60_000)), "Vence en 5 min");
  });

  it("the history counts finished retos only", () => {
    const rows = [
      { fromUserId: "a", toUserId: "b", status: "jugado", fromScore: 7, toScore: 5 },
      { fromUserId: "b", toUserId: "a", status: "jugado", fromScore: 3, toScore: 3 },
      { fromUserId: "b", toUserId: "a", status: "jugado", fromScore: 400, toScore: 410 },
      { fromUserId: "a", toUserId: "b", status: "vencido", fromScore: 9, toScore: null },
      { fromUserId: "a", toUserId: "b", status: "abierto", fromScore: 9, toScore: null },
      { fromUserId: "a", toUserId: "b", status: "cancelado", fromScore: 2, toScore: 1 },
    ];
    assert.deepEqual(headToHead(rows, "a"), { mine: 2, theirs: 0, ties: 1, played: 3 });
    assert.equal(headToHeadLine(headToHead(rows, "a")), "Van 2 a 0 a tu favor");
    assert.equal(headToHeadLine(headToHead(rows, "b")), "Van 2 a 0 en tu contra");
    assert.equal(headToHeadLine(headToHead([], "a")), "Nunca han jugado");
  });

  it("names: the first name, with an initial only when two share it, never an email", () => {
    const names = retoNames([
      { id: "1", name: "Ana Ruiz" },
      { id: "2", name: "Ana López" },
      { id: "3", name: "Luis Pérez Gómez" },
      { id: "4", name: null },
    ]);
    assert.deepEqual([...names.values()], ["Ana R.", "Ana L.", "Luis", "Alguien"]);
  });
});

describe("Mayor o menor, muerte súbita (FIL-I53-2)", () => {
  it("the longer streak wins and the same pair is a tie", () => {
    assert.equal(retoOutcome(7, 5), "from");
    assert.equal(retoOutcome(5, 7), "to");
    // Both missed pair 8: same streak, a tie.
    assert.equal(retoOutcome(7, 7), "empate");
  });

  it("puts the rival's mark on the pair where they fell", () => {
    // Luis got 7 right, so he fell on pair 8; the person got 5 right and is on pair 6.
    const track = suddenDeathTrack({ rivalName: "Luis", rivalScore: 7, mine: 5, total: 119 });
    assert.equal(track.rivalPair, 8);
    assert.equal(track.myPair, 6);
    assert.equal(track.label, "Vas en el par 6; Luis cayó en el 8");
    assert.equal(track.line, "Tres más y le ganas. Si fallas aquí, gana Luis.");
    assert.ok(track.mePct < track.rivalPct!);
    assert.equal(track.rivalPct, 80);
    assert.equal(suddenDeathTrack({ rivalName: "Luis", rivalScore: 7, mine: 7, total: 119 }).line, "Si aciertas esta, le ganas. Si fallas, empatan.");
    assert.equal(suddenDeathTrack({ rivalName: "Luis", rivalScore: 7, mine: 8, total: 119 }).line, "Ya le ganaste a Luis. Sigue hasta donde llegues.");
    // A rival who fell on the first pair.
    assert.equal(suddenDeathTrack({ rivalName: "Luis", rivalScore: 0, mine: 0, total: 119 }).rivalPair, 1);
    // A rival who never missed has no mark.
    const clean = suddenDeathTrack({ rivalName: "Luis", rivalScore: 4, mine: 1, total: 4 });
    assert.equal(clean.rivalPair, null);
    assert.equal(clean.rivalPct, null);
  });
});

describe("«Te retaron» (FIL-I53-3)", () => {
  const today = "2031-02-02";
  it("two retos the same day send a single push", () => {
    const sent = new Set<string>();
    const person = { retosPush: true, hasSubscription: true, sent };
    let pushes = 0;
    for (let reto = 0; reto < 2; reto += 1) {
      if (shouldPushReto(person, today)) {
        pushes += 1;
        sent.add(retoPushLens(today));
      }
    }
    assert.equal(pushes, 1);
    // The next day pushes again.
    assert.equal(shouldPushReto(person, "2031-02-03"), true);
  });

  it("the switch off means no push; it needs a device", () => {
    assert.equal(shouldPushReto({ retosPush: false, hasSubscription: true, sent: new Set() }, today), false);
    assert.equal(shouldPushReto({ retosPush: true, hasSubscription: false, sent: new Set() }, today), false);
  });

  it("the copy has no guilt and no urgency", () => {
    const payload = retoPushPayload({ fromName: "Ana", juegoName: "Duelo de trivia", url: "/extras/retos/x" });
    assert.equal(payload.title, "Ana te retó");
    assert.doesNotMatch(`${payload.title} ${payload.body}`, /ya|rápido|pierdes|vence|últim|!|urgente/i);
  });
});

describe("Métricas de retos (FIL-I53-7)", () => {
  it("counts sent, by link, played and expired per Mexico City week", () => {
    const week = "2031-03-03";
    const at = (iso: string) => new Date(iso);
    const rows = [
      { juego: "trivia", toUserId: "b", status: "jugado", sentAt: at("2031-03-03T18:00:00Z"), expiresAt: at("2031-03-05T18:00:00Z"), finishedAt: at("2031-03-04T18:00:00Z") },
      { juego: "mayor", toUserId: null, status: "abierto", sentAt: at("2031-03-04T18:00:00Z"), expiresAt: at("2031-03-06T18:00:00Z"), finishedAt: null },
      { juego: "gustos", toUserId: "c", status: "vencido", sentAt: at("2031-03-04T18:00:00Z"), expiresAt: at("2031-03-06T18:00:00Z"), finishedAt: null },
      // Open but past its 48 h: counted as expired even before the sweep marks it.
      { juego: "mayor", toUserId: "c", status: "abierto", sentAt: at("2031-03-05T18:00:00Z"), expiresAt: at("2031-03-07T18:00:00Z"), finishedAt: null },
      // Never sent (the sender left it half played): not «mandado».
      { juego: "trivia", toUserId: "c", status: "abierto", sentAt: null, expiresAt: at("2031-03-07T18:00:00Z"), finishedAt: null },
    ];
    const [report] = retosMetrics(rows, [week], at("2031-03-08T18:00:00Z"));
    assert.deepEqual(report, { week, sent: 3, byLink: 1, played: 1, expired: 3 });
  });
});
