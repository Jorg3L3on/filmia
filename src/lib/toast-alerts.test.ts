import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { dismissToast, getToasts } from "@/lib/toast";
import {
  TOAST_COPY,
  addedToLists,
  addedToNamedList,
  isNetworkFailure,
  removedFromNamedList,
  retryAfterRevert,
  showActionError,
  showMaybeNetworkError,
  toastPoster,
  toastWithPoster,
} from "@/lib/toast-alerts";

const clearToasts = () => {
  for (const item of getToasts()) {
    dismissToast(item.id);
  }
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("toast copy", () => {
  it("keeps the two lines Jorge has not decided", () => {
    assert.equal(TOAST_COPY.notTonight, "Ahora no");
    assert.equal(TOAST_COPY.neverSuggest, "No te la volveremos a sugerir");
    assert.equal(TOAST_COPY.alreadyInactive, "Ya no estaba activa.");
  });

  it("agrees Añadida/Quitada with the film, and pluralizes several lists", () => {
    assert.equal(addedToLists(1), "Añadida a tu lista");
    assert.equal(addedToLists(3), "Añadidas a 3 listas");
    assert.equal(addedToNamedList("Noir de domingo"), "Añadida a Noir de domingo");
    assert.equal(removedFromNamedList("Favoritas"), "Quitada de Favoritas");
  });

  it("builds a w185 poster and leaves the icon when there is no path", () => {
    assert.equal(toastPoster(null), undefined);
    assert.equal(toastPoster("/poster.jpg"), "https://image.tmdb.org/t/p/w185/poster.jpg");
  });
});

describe("network versus validation", () => {
  it("treats a fetch TypeError as a network failure and a permission Error as not one", () => {
    assert.equal(isNetworkFailure(new TypeError("Failed to fetch")), true);
    assert.equal(isNetworkFailure(new TypeError("Load failed")), true);
    assert.equal(isNetworkFailure(new Error("Ese rol no está disponible en esta lista.")), false);
    assert.equal(isNetworkFailure(new Error("Eres la persona dueña de esta lista.")), false);
    assert.equal(isNetworkFailure({ ok: false, error: "Año no válido." }), false);
  });

  it("offers Reintentar for a fetch failure and withholds it for a permission Error", () => {
    clearToasts();
    showMaybeNetworkError(new Error("Ese rol no está disponible en esta lista."), {
      title: TOAST_COPY.couldNotSave,
      retry: () => Promise.resolve(),
    });
    assert.equal(getToasts().at(-1)?.action, undefined);
    assert.match(getToasts().at(-1)?.description ?? "", /rol no está disponible/);

    showMaybeNetworkError(new TypeError("Failed to fetch"), {
      title: TOAST_COPY.couldNotSave,
      retry: () => Promise.resolve(),
    });
    const network = getToasts().at(-1);
    assert.equal(network?.action?.label, TOAST_COPY.retry);
    assert.equal(network?.description, TOAST_COPY.retryHint);
    clearToasts();
  });
});

describe("Reintentar runs once", () => {
  const safe = [
    "quitar del diario",
    "guardar visto",
    "deshacer visto",
    "guardar nota",
    "quitar de Quiero ver",
    "agregar a la lista",
    "quitar de la lista",
    "decidir solicitud",
  ];

  for (const name of safe) {
    it(`${name}: the button runs the operation once and the next failure has no button`, async () => {
      clearToasts();
      let runs = 0;
      showActionError({
        title: TOAST_COPY.couldNotSave,
        description: name,
        retry: async () => {
          runs += 1;
          throw new Error(name);
        },
      });
      const first = getToasts().at(-1);
      assert.equal(first?.action?.label, TOAST_COPY.retry);
      first?.action?.onClick();
      await flush();
      assert.equal(runs, 1);
      const second = getToasts().at(-1);
      assert.equal(second?.action, undefined);
      assert.equal(second?.description, name);
      assert.equal(second?.title, TOAST_COPY.couldNotSave);
      clearToasts();
    });
  }

  it("hides a raw network message when the retry fails", async () => {
    clearToasts();
    showActionError({
      title: TOAST_COPY.couldNotSave,
      description: "Failed to fetch",
      retry: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    getToasts().at(-1)?.action?.onClick();
    await flush();
    const second = getToasts().at(-1);
    assert.equal(second?.action, undefined);
    assert.equal(second?.description, TOAST_COPY.retryFailed);
    clearToasts();
  });

  it("keeps a caller's poster when the fallback is missing", () => {
    assert.deepEqual(toastWithPoster({ title: "Añadida a Quiero ver", poster: "/propia.jpg" }, undefined), {
      title: "Añadida a Quiero ver",
      poster: "/propia.jpg",
    });
    assert.deepEqual(toastWithPoster({ title: "Añadida a Quiero ver" }, "/catalogo.jpg"), {
      title: "Añadida a Quiero ver",
      poster: "/catalogo.jpg",
    });
    assert.deepEqual(toastWithPoster({ title: "Añadida a Quiero ver" }, undefined), {
      title: "Añadida a Quiero ver",
    });
  });

  it("re-applies optimistic state and reverts it when the retry throws", async () => {
    const state: string[] = [];
    await assert.rejects(
      retryAfterRevert(
        () => state.push("on"),
        () => state.push("off"),
        async () => {
          throw new Error("red");
        },
      ),
    );
    assert.deepEqual(state, ["on", "off"]);

    await retryAfterRevert(
      () => state.push("on"),
      () => state.push("off"),
      async () => undefined,
    );
    assert.deepEqual(state, ["on", "off", "on"]);
  });
});

const sourceFiles = (dir: string): string[] => {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
};

describe("loose durations", () => {
  it("has no six-second duration override anywhere under src", () => {
    const needle = "durationMs:" + " 6000";
    const hits = sourceFiles("src").filter((file) => readFileSync(file, "utf8").includes(needle));
    assert.deepEqual(hits, []);
  });

  it("keeps the diary undo at its own 7s", () => {
    assert.match(readFileSync("src/lib/diary-undo.ts", "utf8"), /durationMs: DIARY_UNDO_MS/);
  });
});
