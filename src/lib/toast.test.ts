import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import {
  dismissToast,
  getToasts,
  pauseAllToasts,
  pauseToast,
  resolveToastDuration,
  resumeAllToasts,
  resumeToast,
  shouldDismissSwipe,
  showToast,
  updateToast,
} from "./toast";
import { TMDB_UNAVAILABLE_COPY, TmdbRequestError, tmdbErrorMessage } from "./tmdb";

const clearToasts = () => {
  for (const item of getToasts()) {
    dismissToast(item.id);
  }
};

describe("showToast", () => {
  it("keeps the latest toasts and can dismiss them", () => {
    for (const item of getToasts()) {
      dismissToast(item.id);
    }
    showToast({ title: "Uno" });
    showToast({ title: "Dos" });
    const third = showToast({ title: "Tres" });
    const fourth = showToast({ title: "Cuatro" });
    const titles = getToasts().map((item) => item.title);
    assert.deepEqual(titles, ["Dos", "Tres", "Cuatro"]);
    dismissToast(third);
    assert.deepEqual(
      getToasts().map((item) => item.title),
      ["Dos", "Cuatro"],
    );
    dismissToast(fourth);
    dismissToast(getToasts()[0]?.id ?? -1);
    assert.equal(getToasts().length, 0);
  });
});

describe("tmdb user copy", () => {
  it("hides infra names when the API key is missing", () => {
    const error = new TmdbRequestError(
      "missing_key",
      "Falta TMDB_API_KEY. Agrégala en el entorno para buscar títulos.",
    );
    assert.equal(tmdbErrorMessage(error), TMDB_UNAVAILABLE_COPY);
    assert.equal(error.message.includes("TMDB_API_KEY"), true);
    assert.equal(TMDB_UNAVAILABLE_COPY.includes("TMDB_API_KEY"), false);
    assert.equal(TMDB_UNAVAILABLE_COPY.includes(".env"), false);
  });

  it("maps unauthorized TMDB responses to the same friendly copy", () => {
    const unauthorized = new TmdbRequestError("http", "TMDB respondió 401.", 401);
    assert.equal(tmdbErrorMessage(unauthorized), TMDB_UNAVAILABLE_COPY);
    assert.equal(tmdbErrorMessage(unauthorized).includes("401"), false);
    assert.equal(
      tmdbErrorMessage(new Error("Falta TMDB_API_KEY en .env")),
      TMDB_UNAVAILABLE_COPY,
    );
  });
});

describe("toast contract", () => {
  afterEach(() => {
    clearToasts();
  });

  it("returns a numeric id and updateToast mutates that toast", () => {
    const id = showToast({ key: "import", title: "Importando…", variant: "progress", progress: 0.2 });
    assert.equal(typeof id, "number");
    updateToast("import", { progress: 0.7 });
    assert.equal(getToasts().length, 1);
    assert.equal(getToasts()[0]?.progress, 0.7);
    assert.equal(getToasts()[0]?.id, id);
    updateToast("import", { title: "Listo", variant: "success" });
    const again = showToast({ key: "import", title: "Listo", variant: "success" });
    assert.equal(again, id);
    assert.equal(getToasts().length, 1);
    assert.equal(getToasts()[0]?.title, "Listo");
    assert.equal(getToasts()[0]?.variant, "success");
    updateToast("missing", { title: "Nada" });
    assert.equal(getToasts().length, 1);
  });

  it("replaces a repeated error instead of stacking it", () => {
    const first = showToast({ title: "No se pudo guardar", description: "Red", variant: "error" });
    const second = showToast({ title: "No se pudo guardar", description: "Red", variant: "error" });
    assert.equal(second, first);
    assert.equal(getToasts().length, 1);
    assert.equal(getToasts()[0]?.count, 1);
    showToast({ title: "No se pudo guardar", description: "Otra causa", variant: "error" });
    assert.equal(getToasts().length, 2);
  });

  it("drops the poster when a burst mixes different films and keeps it when they match", () => {
    clearToasts();
    showToast({ title: "Añadida a Quiero ver", poster: "/posters/dune.jpg" });
    showToast({ title: "Añadida a Quiero ver", poster: "/posters/aftersun.jpg" });
    showToast({ title: "Añadida a Quiero ver", poster: "/posters/carta.jpg" });
    assert.equal(getToasts().length, 1);
    assert.equal(getToasts()[0]?.count, 3);
    assert.equal(getToasts()[0]?.poster, undefined);
    assert.equal(getToasts()[0]?.title, "Añadida a Quiero ver");

    clearToasts();
    showToast({ title: "Añadida a Quiero ver", poster: "/posters/dune.jpg" });
    showToast({ title: "Añadida a Quiero ver", poster: "/posters/dune.jpg" });
    assert.equal(getToasts().length, 1);
    assert.equal(getToasts()[0]?.count, 2);
    assert.equal(getToasts()[0]?.poster, "/posters/dune.jpg");
    clearToasts();
  });

  it("groups a burst of the same non-error and never drops an error to do it", () => {
    showToast({ title: "En la lista", description: "Casa", variant: "success" });
    showToast({ title: "En la lista", description: "Casa", variant: "success" });
    assert.equal(getToasts().length, 1);
    assert.equal(getToasts()[0]?.count, 2);
    showToast({ title: "No se pudo guardar", variant: "error" });
    showToast({ title: "Nota guardada" });
    showToast({ title: "En Quiero ver" });
    const titles = getToasts().map((item) => item.title);
    assert.equal(titles.includes("No se pudo guardar"), true);
    assert.equal(getToasts().length <= 3, true);
    clearToasts();
    showToast({ title: "Fallo A", variant: "error" });
    showToast({ title: "Fallo B", variant: "error" });
    showToast({ title: "Fallo C", variant: "error" });
    const refused = showToast({ title: "Un éxito de más" });
    assert.deepEqual(
      getToasts().map((item) => item.title),
      ["Fallo A", "Fallo B", "Fallo C"],
    );
    assert.equal(refused, -1);
  });

  it("resolves the default durations and honors an explicit durationMs", () => {
    const undo = { label: "Deshacer", onClick: () => {} };
    const retry = { label: "Reintentar", onClick: () => {} };
    assert.equal(resolveToastDuration({}), 4000);
    assert.equal(resolveToastDuration({ variant: "info" }), 5000);
    assert.equal(resolveToastDuration({ action: undo }), 7000);
    assert.equal(resolveToastDuration({ variant: "error", action: undo }), 7000);
    assert.equal(resolveToastDuration({ variant: "error", action: retry }), null);
    assert.equal(resolveToastDuration({ variant: "warning" }), null);
    assert.equal(resolveToastDuration({ variant: "error" }), 8000);
    assert.equal(resolveToastDuration({ variant: "progress" }), null);
    assert.equal(resolveToastDuration({ variant: "success", durationMs: 1500 }), 1500);
    assert.equal(resolveToastDuration({ variant: "warning", persistent: false }), 8000);
    assert.equal(resolveToastDuration({ variant: "success", persistent: true }), null);
    assert.equal(shouldDismissSwipe(10, 50), true);
    assert.equal(shouldDismissSwipe(44, 10_000), false);
    assert.equal(shouldDismissSwipe(45, 10_000), true);
  });
});

describe("toast timer", () => {
  afterEach(() => {
    clearToasts();
    mock.timers.reset();
  });

  it("dismisses on the variant clock, pauses for hover, focus, press and a hidden tab", () => {
    mock.timers.enable({ apis: ["setTimeout", "Date"] });
    const undo = { label: "Deshacer", onClick: () => {} };

    showToast({ title: "Éxito" });
    mock.timers.tick(3999);
    assert.equal(getToasts().length, 1);
    mock.timers.tick(1);
    assert.equal(getToasts().length, 0);

    showToast({ title: "Aviso", variant: "info" });
    mock.timers.tick(5000);
    assert.equal(getToasts().length, 0);

    showToast({ title: "En el diario", action: undo });
    mock.timers.tick(6999);
    assert.equal(getToasts().length, 1);
    mock.timers.tick(1);
    assert.equal(getToasts().length, 0);

    showToast({ title: "Corto", durationMs: 1500 });
    mock.timers.tick(1500);
    assert.equal(getToasts().length, 0);

    showToast({ title: "Reintenta", variant: "error", action: { label: "Reintentar", onClick: () => {} } });
    showToast({ title: "Cuidado", variant: "warning" });
    showToast({ title: "Bajando", variant: "progress", key: "job" });
    mock.timers.tick(60_000);
    assert.deepEqual(
      getToasts().map((item) => item.title),
      ["Reintenta", "Cuidado", "Bajando"],
    );
    clearToasts();

    const id = showToast({ title: "Pausa" });
    mock.timers.tick(2000);
    pauseToast(id, "hover");
    mock.timers.tick(20_000);
    assert.equal(getToasts()[0]?.title, "Pausa");
    pauseToast(id, "focus");
    resumeToast(id, "hover");
    mock.timers.tick(20_000);
    assert.equal(getToasts().length, 1);
    resumeToast(id, "focus");
    mock.timers.tick(1999);
    assert.equal(getToasts().length, 1);
    mock.timers.tick(1);
    assert.equal(getToasts().length, 0);

    const pressed = showToast({ title: "Pulsado" });
    mock.timers.tick(1000);
    pauseToast(pressed, "press");
    mock.timers.tick(10_000);
    resumeToast(pressed, "press");
    mock.timers.tick(3000);
    assert.equal(getToasts().length, 0);

    const hidden = showToast({ title: "Oculto" });
    mock.timers.tick(1000);
    pauseAllToasts("hidden");
    mock.timers.tick(30_000);
    assert.equal(getToasts()[0]?.id, hidden);
    resumeAllToasts("hidden");
    mock.timers.tick(3000);
    assert.equal(getToasts().length, 0);

    showToast({ key: "job", title: "Importando…", variant: "progress" });
    mock.timers.tick(30_000);
    assert.equal(getToasts().length, 1);
    updateToast("job", { title: "Listo", variant: "success" });
    mock.timers.tick(4000);
    assert.equal(getToasts().length, 0);
  });
});
