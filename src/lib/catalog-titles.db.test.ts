import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, it } from "node:test";
import { eq, sql } from "drizzle-orm";
import { catalog, db } from "@/db";
import { catalogTitlesMatchSql } from "@/lib/catalog-search-db";
import { closeLocalPg } from "@/db/local-pg";
import { seeder } from "@/lib/test-support/seed";

const seed = seeder("altnames");

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

describeWithDb("Catalog title columns on a local database (FIL-I48-1)", () => {
  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("applies the additive migration and stores the Mexican name, original, and search strings", async () => {
    for (const statement of statements()) {
      await db.execute(sql.raw(statement));
    }

    const film = await seed.film({ name: "Intensamente", year: 2015 });
    await db
      .update(catalog)
      .set({
        name: "Intensa-Mente",
        originalName: "Inside Out",
        alternateNames: ["Intensamente", "Inside Out"],
      })
      .where(eq(catalog.id, film.catalogId));

    const stored = await db.query.catalog.findFirst({ where: eq(catalog.id, film.catalogId) });
    assert.equal(stored?.name, "Intensa-Mente");
    assert.equal(stored?.originalName, "Inside Out");
    assert.deepEqual(stored?.alternateNames, ["Intensamente", "Inside Out"]);

    const byOriginal = await db
      .select({ id: catalog.id })
      .from(catalog)
      .where(catalogTitlesMatchSql("Inside Out"));
    const byMexican = await db
      .select({ id: catalog.id })
      .from(catalog)
      .where(catalogTitlesMatchSql("Intensa-Mente"));
    assert.ok(byOriginal.some((hit) => hit.id === film.catalogId));
    assert.ok(byMexican.some((hit) => hit.id === film.catalogId));
    assert.equal(
      byOriginal.find((hit) => hit.id === film.catalogId)?.id,
      byMexican.find((hit) => hit.id === film.catalogId)?.id,
    );

    const equal = await seed.film({ name: "El origen", year: 2010 });
    await db
      .update(catalog)
      .set({ name: "El origen", originalName: "Inception", alternateNames: ["Inception"] })
      .where(eq(catalog.id, equal.catalogId));
    const same = await db.query.catalog.findFirst({ where: eq(catalog.id, equal.catalogId) });
    assert.notEqual(same?.name, same?.originalName);
    assert.deepEqual(same?.alternateNames, ["Inception"]);
  });
});
