import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completeRetriedSave,
  reportLeaveFailure,
  reportMemberChangeFailure,
  reportPickFailure,
  showAlreadyInactive,
  startWatchedUndo,
} from "@/lib/alert-retry";
import { dismissToast, getToasts } from "@/lib/toast";
import { TOAST_COPY } from "@/lib/toast-alerts";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const clear = () => {
  for (const item of getToasts()) {
    dismissToast(item.id);
  }
};

describe("zona (a) · guardar visto", () => {
  it("clears the inline error and confirms only when the retry lands", async () => {
    let error: string | null = "No se pudo guardar";
    let confirmed = 0;
    await assert.rejects(
      completeRetriedSave(
        async () => {
          throw new Error("red");
        },
        () => {
          error = null;
          confirmed += 1;
        },
      ),
    );
    assert.equal(error, "No se pudo guardar");
    assert.equal(confirmed, 0);

    await completeRetriedSave(
      async () => undefined,
      () => {
        error = null;
        confirmed += 1;
      },
    );
    assert.equal(error, null);
    assert.equal(confirmed, 1);
  });
});

describe("zona (b) · deshacer visto", () => {
  it("hides the card after the first failure and again after the retry fails", async () => {
    clear();
    const ui: string[] = [];
    startWatchedUndo({
      apply: () => ui.push("en quiero ver"),
      revert: () => ui.push("sigue vista"),
      undo: async () => {
        throw new TypeError("Failed to fetch");
      },
      description: "Aftersun",
    });
    await flush();
    assert.deepEqual(ui, ["en quiero ver", "sigue vista"]);
    const first = getToasts().at(-1);
    assert.equal(first?.action?.label, TOAST_COPY.retry);
    first?.action?.onClick();
    await flush();
    assert.deepEqual(ui, ["en quiero ver", "sigue vista", "en quiero ver", "sigue vista"]);
    const second = getToasts().at(-1);
    assert.equal(second?.action, undefined);
    assert.equal(second?.description, TOAST_COPY.retryFailed);
    clear();
  });

  it("confirms when the retry lands and leaves the card back in Quiero ver", async () => {
    clear();
    const ui: string[] = [];
    let attempt = 0;
    startWatchedUndo({
      apply: () => ui.push("en quiero ver"),
      revert: () => ui.push("sigue vista"),
      undo: async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new TypeError("Failed to fetch");
        }
      },
      description: "Dune: Parte dos",
    });
    await flush();
    getToasts().at(-1)?.action?.onClick();
    await flush();
    assert.deepEqual(ui, ["en quiero ver", "sigue vista", "en quiero ver"]);
    assert.equal(getToasts().at(-1)?.title, TOAST_COPY.addedWatchlist);
    assert.equal(getToasts().at(-1)?.description, "Dune: Parte dos");
    clear();
  });

  it("does not offer Reintentar for a pick event", () => {
    clear();
    reportPickFailure();
    const toast = getToasts().at(-1);
    assert.equal(toast?.title, TOAST_COPY.couldNotSave);
    assert.equal(toast?.action, undefined);
    clear();
  });
});

describe("zona (c) · miembros", () => {
  it("retries toggleInvite only on a network failure", () => {
    clear();
    reportMemberChangeFailure(new Error("Ese rol no está disponible en esta lista."), async () => undefined);
    assert.equal(getToasts().at(-1)?.action, undefined);
    clear();
    reportMemberChangeFailure(new TypeError("Failed to fetch"), async () => undefined);
    assert.equal(getToasts().at(-1)?.action?.label, TOAST_COPY.retry);
    clear();
  });

  it("does not offer Reintentar for leaving a list", () => {
    clear();
    reportLeaveFailure();
    const toast = getToasts().at(-1);
    assert.equal(toast?.title, TOAST_COPY.couldNotLeave);
    assert.equal(toast?.action, undefined);
    clear();
  });
});

describe("zona (d) · conexión inactiva", () => {
  it("says it was already inactive, as info, with no button", () => {
    clear();
    showAlreadyInactive();
    const toast = getToasts().at(-1);
    assert.equal(toast?.title, "Ya no estaba activa.");
    assert.equal(toast?.variant, "info");
    assert.equal(toast?.action, undefined);
    clear();
  });
});
