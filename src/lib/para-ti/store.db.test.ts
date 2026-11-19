import "@/lib/test-support/node-async-local-storage";
import "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { dismissParaTi, undoDismissParaTi } from "@/app/actions/para-ti";
import { db, paraTiPool, pickEvents } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { forgetUserAffinity } from "@/lib/affinity-store";
import { DEFAULT_FILTERS } from "@/lib/para-ti/rank";
import { forgetParaTiCaches, loadAntojoTitles } from "@/lib/para-ti/store";
import { describeWithDb } from "@/lib/test-support/local-db";
import { runAsUser } from "@/lib/test-support/run-as-user";
import { seeder } from "@/lib/test-support/seed";

describeWithDb("Para ti loader and «No me interesa» (FIL-I60-3)", () => {
  const seed = seeder("t-para-ti");
  let ana = "";
  let beto = "";
  const films: Record<string, string> = {};

  before(async () => {
    ana = await seed.user("Ana", ["NETFLIX"]);
    beto = await seed.user("Beto", ["NETFLIX"]);
    for (const name of ["vista", "quiero", "abandonada", "descartada", "libre", "otra", "fuera"]) {
      const { catalogId } = await seed.film({
        name,
        genres: ["Comedia"],
        platforms: name === "fuera" ? ["DISNEY"] : ["NETFLIX"],
      });
      films[name] = catalogId;
    }
    await seed.title(ana, films.vista!, { watchedAt: new Date("2026-01-02"), rating: 8 });
    await seed.title(ana, films.quiero!);
    await seed.queue(ana, films.quiero!);
    await seed.title(ana, films.abandonada!);
    await db.insert(paraTiPool).values(
      Object.values(films).map((catalogId, rank) => ({
        antojo: "reir",
        kind: "MOVIE" as const,
        catalogId,
        rank,
        voteAverage: 7.5,
        voteCount: 900,
      })),
    );
    forgetParaTiCaches();
  });

  after(async () => {
    await db.delete(paraTiPool).where(inArray(paraTiPool.catalogId, Object.values(films)));
    await seed.cleanup();
    await closeLocalPg();
  });

  const shown = async (userId: string, filters = DEFAULT_FILTERS) => {
    forgetUserAffinity(userId);
    const reading = await loadAntojoTitles(userId, "reir", filters);
    return new Set(reading.titles.map((title) => title.catalogId));
  };

  it("never shows a watched, Quiero ver, dropped (any library) or dismissed title", async () => {
    const result = await runAsUser(ana, () => dismissParaTi(films.descartada!));
    assert.deepEqual(result, { ok: true });
    const ids = await shown(ana);
    for (const name of ["vista", "quiero", "abandonada", "descartada"]) {
      assert.equal(ids.has(films[name]!), false, name);
    }
    assert.ok(ids.has(films.libre!) && ids.has(films.otra!));
    // Off-platform only with the switch off.
    assert.equal(ids.has(films.fuera!), false);
    assert.ok((await shown(ana, { ...DEFAULT_FILTERS, onlyMine: false })).has(films.fuera!));
    // Beto's shelf is his own: Ana's library and dismissal do not touch it.
    const betos = await shown(beto);
    assert.ok(betos.has(films.vista!) && betos.has(films.descartada!));
  });

  it("refuses another person's undo and an unknown film; the owner's undo restores the title", async () => {
    const stranger = await runAsUser(beto, () => undoDismissParaTi(films.descartada!));
    assert.equal(stranger.ok, false);
    const still = await db.query.pickEvents.findFirst({
      where: and(eq(pickEvents.userId, ana), eq(pickEvents.catalogId, films.descartada!), eq(pickEvents.kind, "less_like")),
    });
    assert.ok(still, "Ana's dismissal survives Beto's undo");
    assert.equal((await runAsUser(ana, () => dismissParaTi("no-existe-este-id"))).ok, false);
    await assert.rejects(runAsUser(null, () => dismissParaTi(films.libre!)));

    const undone = await runAsUser(ana, () => undoDismissParaTi(films.descartada!));
    assert.deepEqual(undone, { ok: true });
    assert.ok((await shown(ana)).has(films.descartada!));
  });
});
