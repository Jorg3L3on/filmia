import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { watchlistAlertHint, watchlistAlertToast } from "./cine-visible-alert";

const TODAY = "2026-10-21";

describe("«Llega a cines» visible (FIL-I23-2)", () => {
  it("hints the premiere day only for an upcoming film", () => {
    assert.equal(watchlistAlertHint({ status: "upcoming", mxReleaseDate: "2026-10-22" }, TODAY), "Te avisamos el jue 22 oct");
    assert.equal(watchlistAlertHint({ status: "now", mxReleaseDate: "2026-10-15" }, TODAY), null);
  });

  it("toasts the day, and points at Perfil when push is off on this device", () => {
    const film = { name: "Wildwood", status: "upcoming", mxReleaseDate: "2026-10-29" };
    assert.deepEqual(watchlistAlertToast(film, TODAY, true), {
      title: "Añadida a Quiero ver",
      description: "«Wildwood» se estrena el jue 29 oct. Te avisamos ese día.",
      needsPush: false,
    });
    assert.match(watchlistAlertToast(film, TODAY, false)?.description ?? "", /Enciende los avisos en Perfil/);
    assert.equal(watchlistAlertToast({ ...film, status: "now" }, TODAY, true), null);
  });
});
