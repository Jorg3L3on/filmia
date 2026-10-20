import { describeWithDb } from "@/lib/test-support/local-db";
import "@/lib/test-support/oauth";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import { closeLocalPg } from "@/db/local-pg";
import { mcpTestbed, toolData } from "@/lib/test-support/mcp";
import { seeder } from "@/lib/test-support/seed";
import { getTonightDecks } from "@/lib/tonight-store";
import { executeTool, type ToolDefinition } from "./define-tool";
import { mcpToolDefinitions } from "./server";

const tool = (name: string) => mcpToolDefinitions().find((definition) => definition.name === name) as ToolDefinition;

const NOW = new Date("2026-10-20T18:00:00Z");

/** Recursively: no camelCase keys anywhere, and no e-mail address of anyone. */
const assertCleanOutput = (value: unknown, path = "$") => {
  if (Array.isArray(value)) return value.forEach((item, index) => assertCleanOutput(item, `${path}[${index}]`));
  if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      assert.equal(/[a-z][A-Z]/.test(key), false, `camelCase key ${path}.${key}`);
      assertCleanOutput(inner, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string") assert.equal(/@filmia\.test/.test(value), false, `e-mail in ${path}`);
};

describe("read tools never touch the database directly (FIL-I20-3)", () => {
  it("has no db.select or sql` inside src/lib/mcp/tools", async () => {
    const dir = new URL("./tools/", import.meta.url);
    for (const file of await readdir(dir)) {
      const source = await readFile(new URL(file, dir), "utf8");
      assert.equal(/\bdb\.(select|insert|update|delete|query|execute)\b|sql`|from "@\/db"/.test(source), false, file);
    }
  });
});

describeWithDb("read tools against the local database (FIL-I20-3)", () => {
  const seed = seeder("t-read");
  const bed = mcpTestbed();
  bed.tools.now = () => NOW;
  let ana: string;
  let leo: string;
  let otherList: string;
  let sharedList: string;
  const films: Record<string, { catalogId: string; tmdbId: number }> = {};

  const call = async (userId: string, name: string, args: Record<string, unknown> = {}, canWrite = false) =>
    toolData<Record<string, unknown>>(
      await executeTool(
        tool(name),
        bed.tools,
        {
          userId,
          source: "personal_token",
          connectionId: `conn-${userId}`,
          clientName: "Prueba",
          scopes: canWrite ? ["read", "write"] : ["read"],
          canWrite,
          expiresAt: new Date("2030-01-01T00:00:00Z"),
        },
        args,
      ),
    );

  before(async () => {
    ana = await seed.user("Ana", ["NETFLIX", "MAX"]);
    leo = await seed.user("Leo", ["NETFLIX"]);
    films.short = await seed.film({ name: "Corta en Netflix", runtime: 95, platforms: ["NETFLIX"], genres: ["Comedia"] });
    films.long = await seed.film({ name: "Larga en Netflix", runtime: 170, platforms: ["NETFLIX"], genres: ["Drama"] });
    films.max = await seed.film({ name: "Corta en Max", runtime: 90, platforms: ["MAX"], genres: ["Comedia"] });
    films.none = await seed.film({ name: "Sin plataforma", runtime: 100, platforms: [], genres: ["Drama"] });
    films.seen = await seed.film({ name: "Ya vista", runtime: 110, platforms: ["NETFLIX"] });
    for (const [index, key] of ["short", "long", "max", "none"].entries()) {
      await seed.title(ana, films[key]!.catalogId);
      await seed.queue(ana, films[key]!.catalogId, index);
    }
    await seed.title(ana, films.seen!.catalogId, { watchedAt: new Date("2026-10-10T12:00:00Z"), rating: 8 });
    otherList = await seed.collection(leo, "Privada de Leo");
    await seed.addToList(otherList, films.long!.catalogId, leo);
    sharedList = await seed.collection(leo, "Thrillers compartidos", [{ userId: ana, role: "VIEWER" }]);
    await seed.addToList(sharedList, films.short!.catalogId, leo, 0);
    await seed.addToList(sharedList, films.max!.catalogId, leo, 1);
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("whoami says who, how and what the connection may do", async () => {
    const data = await call(ana, "whoami");
    assert.deepEqual(data.user, { name: "Ana" });
    const connection = data.connection as Record<string, unknown>;
    assert.equal(connection.source, "personal_token");
    assert.deepEqual(connection.scopes, ["read"]);
    assert.equal(connection.can_write, false);
    assert.deepEqual((data.platforms as { id: string }[]).map((platform) => platform.id), ["NETFLIX", "MAX"]);
    assertCleanOutput(data);
    const listed = tool("whoami");
    assert.deepEqual(listed.meta, { "openai/profile": true });
  });

  it("get_tonight returns what the Hoy screen shows for the same day", async () => {
    const decks = await getTonightDecks(ana, NOW);
    const data = await call(ana, "get_tonight", { per_lens: 12 });
    const lenses = data.lenses as { slug: string; titles: { title: string }[] }[];
    assert.deepEqual(
      lenses.map((lens) => [lens.slug, lens.titles.map((title) => title.title)]),
      decks.lenses.map((lens) => [lens.slug, lens.titles.slice(0, 12).map((card) => card.name)]),
    );
    assert.ok(lenses.length > 0);
    assertCleanOutput(data);
  });

  it("recommend with Netflix and 120 min returns only Netflix titles of 120 min or less", async () => {
    const data = await call(ana, "recommend", { platforms: ["NETFLIX"], max_runtime_min: 120 });
    const results = data.results as { title: string; runtime_min: number; streaming_on: { id: string }[] }[];
    assert.deepEqual(results.map((result) => result.title), ["Corta en Netflix"]);
    for (const result of results) {
      assert.ok(result.runtime_min <= 120);
      assert.ok(result.streaming_on.some((platform) => platform.id === "NETFLIX"));
    }
    const comedies = await call(ana, "recommend", { genre: "comedia" });
    assert.deepEqual(
      (comedies.results as { title: string }[]).map((result) => result.title).sort(),
      ["Corta en Max", "Corta en Netflix"],
    );
  });

  it("get_list: not_found for someone else's private list; items and role when shared", async () => {
    const hidden = await call(ana, "get_list", { id: otherList });
    assert.equal((hidden.error as { code: string }).code, "not_found");
    const shared = await call(ana, "get_list", { id: sharedList });
    assert.equal(shared.role, "viewer");
    assert.deepEqual((shared.items as { title: string }[]).map((item) => item.title), ["Corta en Netflix", "Corta en Max"]);
    assert.deepEqual(shared.members, [
      { name: "Leo", role: "owner" },
      { name: "Ana", role: "viewer" },
    ]);
    assertCleanOutput(shared);
    const lists = await call(ana, "list_lists");
    const names = (lists.items as { name: string; role: string }[]).map((list) => `${list.name}:${list.role}`);
    assert.ok(names.includes("Thrillers compartidos:viewer"));
    assert.equal(names.some((name) => name.startsWith("Privada de Leo")), false);
  });

  it("pages every list_* to the end with total_count, and refuses a foreign cursor", async () => {
    for (const [name, args] of [
      ["list_library", {}],
      ["list_lists", {}],
      ["list_diary", { from: "2026-01-01" }],
      ["get_list", { id: sharedList }],
    ] as const) {
      const seen: unknown[] = [];
      let cursor: string | undefined;
      let total = -1;
      for (let guard = 0; guard < 50; guard += 1) {
        const page = await call(ana, name, { ...args, limit: 1, ...(cursor ? { cursor } : {}) });
        assert.ok(!page.error, `${name}: ${JSON.stringify(page.error)}`);
        total = page.total_count as number;
        seen.push(...(page.items as unknown[]));
        assert.ok((page.items as unknown[]).length <= 1);
        if (!page.next_cursor) break;
        cursor = page.next_cursor as string;
      }
      assert.equal(seen.length, total, name);
      assert.ok(total > 0, name);
    }
    const first = await call(ana, "list_library", { limit: 1 });
    const foreign = await call(ana, "list_library", { status: "pending", limit: 1, cursor: first.next_cursor });
    assert.equal((foreign.error as { code: string }).code, "validation");
  });

  it("list_library filters by state and platform", async () => {
    const pending = await call(ana, "list_library", { status: "pending" });
    assert.deepEqual(
      (pending.items as { title: string }[]).map((item) => item.title),
      ["Corta en Netflix", "Larga en Netflix", "Corta en Max", "Sin plataforma"],
    );
    const watched = await call(ana, "list_library", { status: "watched" });
    assert.deepEqual((watched.items as { title: string; my_rating: number }[]).map((item) => [item.title, item.my_rating]), [
      ["Ya vista", 8],
    ]);
    const onMax = await call(ana, "list_library", { platform: "MAX" });
    assert.deepEqual((onMax.items as { title: string }[]).map((item) => item.title), ["Corta en Max"]);
  });

  it("get_title and list_diary describe the person's own data", async () => {
    const ficha = await call(ana, "get_title", { id: films.seen!.catalogId });
    assert.equal(ficha.status, "watched");
    assert.equal(ficha.my_rating, 8);
    assert.equal(ficha.watched_on, "2026-10-10");
    assert.equal(ficha.in_library, true);
    const diary = await call(ana, "list_diary", { month: "2026-10" });
    assert.deepEqual((diary.items as { title: string; watched_on: string }[]).map((item) => [item.title, item.watched_on]), [
      ["Ya vista", "2026-10-10"],
    ]);
    const leoView = await call(leo, "get_title", { id: films.seen!.catalogId });
    assert.equal(leoView.status, "not_in_library");
    assert.equal(leoView.my_rating, null);
    assertCleanOutput(ficha);
  });

  it("no response carries camelCase keys or someone's e-mail", async () => {
    for (const [name, args] of [
      ["list_platform_arrivals", {}],
      ["list_cinema", {}],
      ["list_library", {}],
      ["recommend", {}],
    ] as const) {
      const data = await call(ana, name, args);
      assert.ok(!data.error, `${name}: ${JSON.stringify(data.error)}`);
      assertCleanOutput(data);
    }
  });
});
