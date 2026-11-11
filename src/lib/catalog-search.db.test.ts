import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, it } from "node:test";
import { eq, sql } from "drizzle-orm";
import { catalog, db } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { searchStoredCatalog } from "@/lib/catalog-search-db";
import { seeder } from "@/lib/test-support/seed";

const seed = seeder("catsearch");

const statements = () =>
  readFileSync(new URL("../../drizzle/0027_catalog_alternate_names.sql", import.meta.url), "utf8")
    .split("--> statement-breakpoint")
    .map((part) =>
      part
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);

describeWithDb("Stored catalog search on a local database (FIL-I48-2)", () => {
  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("finds one film by the Mexican title and by the original title, and one film whose titles match", async () => {
    for (const statement of statements()) {
      await db.execute(sql.raw(statement));
    }

    const film = await seed.film({ name: "Luces del norte", year: 2014 });
    await db
      .update(catalog)
      .set({
        name: "Luces del norte",
        originalName: "Northern Lights",
        alternateNames: ["Mira Norte"],
      })
      .where(eq(catalog.id, film.catalogId));

    const byMexican = await searchStoredCatalog("Luces del norte", 50);
    const byOriginal = await searchStoredCatalog("Northern Lights", 50);
    const byAlternate = await searchStoredCatalog("Mira Norte", 50);
    const stored = byMexican.find((hit) => hit.id === film.catalogId);
    assert.ok(stored);
    assert.equal(stored.originalName, "Northern Lights");
    assert.equal(byOriginal.some((hit) => hit.id === film.catalogId), true);
    assert.equal(byAlternate.some((hit) => hit.id === film.catalogId), true);
    assert.equal(stored.id, byOriginal.find((hit) => hit.id === film.catalogId)?.id);

    const same = await seed.film({ name: "Lumen", year: 2001 });
    await db
      .update(catalog)
      .set({ name: "Lumen", originalName: "Lumen", alternateNames: [] })
      .where(eq(catalog.id, same.catalogId));
    const lumen = await searchStoredCatalog("Lumen", 50);
    assert.deepEqual(
      lumen.filter((hit) => hit.id === same.catalogId).map((hit) => hit.id),
      [same.catalogId],
    );

    const older = await seed.film({ name: "Ka", year: 1990 });
    const newer = await seed.film({ name: "Ka", year: 2017 });
    await db.update(catalog).set({ originalName: "Ka", alternateNames: ["Kay"] }).where(eq(catalog.id, older.catalogId));
    await db.update(catalog).set({ originalName: "Ka", alternateNames: [] }).where(eq(catalog.id, newer.catalogId));
    const dated = await searchStoredCatalog("Ka 1990", 50);
    assert.ok(dated.some((hit) => hit.id === older.catalogId));
    assert.equal(dated.some((hit) => hit.id === newer.catalogId), false);
  });
});
