import { describeWithDb } from "@/lib/test-support/local-db";
import "@/lib/test-support/oauth";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import { and, count, eq, inArray } from "drizzle-orm";
import { db, listItems, lists, titles } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { WATCHLIST_SLUG } from "@/lib/lists";
import { mcpTestbed, toolData } from "@/lib/test-support/mcp";
import { seeder } from "@/lib/test-support/seed";
import { executeTool, type ToolDefinition } from "./define-tool";
import { postgresIdempotencyStore } from "./idempotency";
import { mcpToolDefinitions } from "./server";
import { writeTools } from "./tools/writes";

const tool = (name: string) => mcpToolDefinitions().find((definition) => definition.name === name) as ToolDefinition;

describe("write tools share the Server Actions' functions (FIL-I20-5)", () => {
  const read = (file: string) => readFile(new URL(`../../../${file}`, import.meta.url), "utf8");

  it("add_to_library and the Quiero ver action call addToWatchlistFor; mark_seen and «Vi esto» call markWatchedFor", async () => {
    const [actions, writes] = await Promise.all([read("src/app/actions/watchlist.ts"), read("src/lib/mcp/tools/writes.ts")]);
    const body = (source: string, name: string) => source.slice(source.indexOf(`export const ${name} =`)).split("\nexport const ")[0]!;
    assert.match(body(actions, "addToWatchlist"), /addToWatchlistFor\(userId, titleId, queueNote\)/);
    assert.match(body(actions, "markTitleWatched"), /markWatchedFor\(userId, titleId, \{/);
    assert.match(body(writes, "addToLibraryTool"), /addToWatchlistFor\(ctx\.userId, titleId, args\.note\)/);
    assert.match(body(writes, "markSeenTool"), /markWatchedFor\(ctx\.userId, titleId, \{/);
    const lists = await read("src/app/actions/lists.ts");
    assert.match(body(lists, "addTitleToList"), /addTitleToListFor\(await requireUserId\(\), listId, titleId\)/);
    assert.match(body(writes, "addToListTool"), /addTitleToListFor\(ctx\.userId, args\.list_id, titleId\)/);
  });

  it("annotations tell the truth", () => {
    const byName = Object.fromEntries(writeTools.map((definition) => [definition.name, definition.annotations ?? {}]));
    for (const destructive of ["mark_seen", "rate_title", "remove_from_list", "set_title_status"]) {
      assert.equal(byName[destructive]!.destructiveHint, true, destructive);
    }
    for (const additive of ["add_to_library", "create_list", "add_to_list"]) {
      assert.notEqual(byName[additive]!.destructiveHint, true, additive);
    }
    for (const once of ["mark_seen", "create_list"]) assert.notEqual(byName[once]!.idempotentHint, true, once);
  });
});

describeWithDb("write tools against the local database (FIL-I20-5)", () => {
  const seed = seeder("t-write");
  const bed = mcpTestbed();
  bed.tools.idempotency = postgresIdempotencyStore;
  bed.tools.now = () => new Date("2026-10-20T18:00:00Z");
  let ana: string;
  let leo: string;
  let film: { catalogId: string; tmdbId: number };
  let series: { catalogId: string; tmdbId: number };
  let other: { catalogId: string; tmdbId: number };
  let viewerList: string;
  let editorList: string;

  const call = async (userId: string, name: string, args: Record<string, unknown>, canWrite = true) =>
    toolData<Record<string, unknown>>(
      await executeTool(
        tool(name),
        bed.tools,
        {
          userId,
          source: "oauth",
          connectionId: `conn-${userId}`,
          clientName: "Claude",
          scopes: canWrite ? ["read", "write"] : ["read"],
          canWrite,
          expiresAt: new Date("2030-01-01T00:00:00Z"),
        },
        args,
      ),
    );

  const errorCode = (data: Record<string, unknown>) => (data.error as { code?: string } | undefined)?.code;

  const footprint = async (userId: string) => {
    const owned = await db.select({ id: lists.id }).from(lists).where(eq(lists.userId, userId));
    const [[titleCount], [itemCount]] = await Promise.all([
      db.select({ n: count() }).from(titles).where(eq(titles.userId, userId)),
      owned.length
        ? db.select({ n: count() }).from(listItems).where(inArray(listItems.listId, owned.map((row) => row.id)))
        : Promise.resolve([{ n: 0 }]),
    ]);
    return { titles: titleCount!.n, items: itemCount!.n, lists: owned.length };
  };

  const watchlistIds = async (userId: string) => {
    const watchlist = await seed.listOf(userId, WATCHLIST_SLUG);
    const rows = await db.select({ catalogId: listItems.catalogId }).from(listItems).where(eq(listItems.listId, watchlist.id));
    return rows.map((row) => row.catalogId);
  };

  const ownTitle = (userId: string, catalogId: string) =>
    db.query.titles.findFirst({ where: and(eq(titles.userId, userId), eq(titles.catalogId, catalogId)) });

  before(async () => {
    ana = await seed.user("Ana", ["NETFLIX"]);
    leo = await seed.user("Leo", ["NETFLIX"]);
    film = await seed.film({ name: "Película nueva", runtime: 100, platforms: ["NETFLIX"] });
    series = await seed.film({ name: "Serie nueva", kind: "SERIES", runtime: 45, platforms: ["NETFLIX"] });
    other = await seed.film({ name: "Otra película", runtime: 120, platforms: [] });
    viewerList = await seed.collection(leo, "Lista donde Ana lee", [{ userId: ana, role: "VIEWER" }]);
    editorList = await seed.collection(leo, "Lista donde Ana edita", [{ userId: ana, role: "EDITOR" }]);
    await seed.addToList(viewerList, other.catalogId, leo);
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("answers writes_disabled for every write tool on a read-only connection and touches nothing", async () => {
    const before = await footprint(ana);
    const args: Record<string, Record<string, unknown>> = {
      add_to_library: { id: film.catalogId, idempotency_key: "ro-add-0001" },
      set_title_status: { id: film.catalogId, status: "pending" },
      mark_seen: { id: film.catalogId, idempotency_key: "ro-seen-0001" },
      rate_title: { id: film.catalogId, rating: 8 },
      create_list: { name: "No debería existir", idempotency_key: "ro-list-0001" },
      add_to_list: { list_id: editorList, id: film.catalogId, idempotency_key: "ro-addl-0001" },
      remove_from_list: { list_id: viewerList, id: other.catalogId, confirm: true },
    };
    for (const definition of writeTools) {
      const data = await call(ana, definition.name, args[definition.name]!, false);
      assert.equal(errorCode(data), "writes_disabled", definition.name);
    }
    assert.deepEqual(await footprint(ana), before);
  });

  it("add_to_library puts a film in Quiero ver once, and a series as watching", async () => {
    const first = await call(ana, "add_to_library", { id: film.catalogId, note: "la recomendó Leo", idempotency_key: "add-film-0001" });
    assert.equal(first.newly_added, true);
    assert.ok((await watchlistIds(ana)).includes(film.catalogId));
    const again = await call(ana, "add_to_library", { id: film.catalogId, idempotency_key: "add-film-0002" });
    assert.equal(again.newly_added, false);
    assert.equal((await watchlistIds(ana)).filter((id) => id === film.catalogId).length, 1);

    const watching = await call(ana, "add_to_library", { id: series.catalogId, status: "watching", idempotency_key: "add-series-01" });
    assert.equal(watching.status, "watching");
    assert.equal((await ownTitle(ana, series.catalogId))?.seriesStatus, "WATCHING");
    const movieWatching = await call(ana, "add_to_library", { id: other.catalogId, status: "watching", idempotency_key: "add-movie-w1" });
    assert.equal(errorCode(movieWatching), "validation");
  });

  it("set_title_status moves a title in and out of Quiero ver and sets a series state", async () => {
    await call(ana, "set_title_status", { id: film.catalogId, status: "not_pending" });
    assert.equal((await watchlistIds(ana)).includes(film.catalogId), false);
    await call(ana, "set_title_status", { id: film.catalogId, status: "pending" });
    assert.ok((await watchlistIds(ana)).includes(film.catalogId));
    await call(ana, "set_title_status", { id: series.catalogId, status: "dropped" });
    assert.equal((await ownTitle(ana, series.catalogId))?.seriesStatus, "DROPPED");
  });

  it("mark_seen with the same idempotency_key runs once; the same key with other arguments is validation", async () => {
    const args = { id: film.catalogId, watched_on: "2026-10-19", rating: 8, note: "Muy buena", idempotency_key: "seen-film-0001" };
    const first = await call(ana, "mark_seen", args);
    assert.equal(first.watched_on, "2026-10-19");
    const entry = await ownTitle(ana, film.catalogId);
    assert.equal(entry?.watchedAt?.toISOString(), "2026-10-19T12:00:00.000Z");
    assert.equal(entry?.rating, 8);
    assert.equal((await watchlistIds(ana)).includes(film.catalogId), false, "left Quiero ver");

    // Undo it by hand: a replay must not run the write again.
    await db.update(titles).set({ watchedAt: null }).where(eq(titles.id, entry!.id));
    const replay = await call(ana, "mark_seen", args);
    assert.deepEqual(replay, first);
    assert.equal((await ownTitle(ana, film.catalogId))?.watchedAt, null);

    const reused = await call(ana, "mark_seen", { ...args, rating: 6 });
    assert.equal(errorCode(reused), "validation");
    const future = await call(ana, "mark_seen", { id: film.catalogId, watched_on: "2026-12-01", idempotency_key: "seen-future-01" });
    assert.equal(errorCode(future), "validation");
  });

  it("rate_title asks for confirm before overwriting a different rating", async () => {
    const overwrite = await call(ana, "rate_title", { id: film.catalogId, rating: 4 });
    assert.equal(errorCode(overwrite), "confirmation_required");
    assert.equal((await ownTitle(ana, film.catalogId))?.rating, 8);
    const confirmed = await call(ana, "rate_title", { id: film.catalogId, rating: 4, review: "Envejeció mal", confirm: true });
    assert.equal(confirmed.rating, 4);
    const row = await ownTitle(ana, film.catalogId);
    assert.equal(row?.rating, 4);
    assert.equal(row?.review, "Envejeció mal");
    const same = await call(ana, "rate_title", { id: film.catalogId, rating: 4 });
    assert.equal(same.rating, 4, "the same rating needs no confirm");
  });

  it("create_list creates once per key and refuses a duplicate name", async () => {
    const created = await call(ana, "create_list", { name: "Domingo", idempotency_key: "list-domingo-1" });
    const list = created.list as { id: string; name: string };
    assert.equal(list.name, "Domingo");
    const replay = await call(ana, "create_list", { name: "Domingo", idempotency_key: "list-domingo-1" });
    assert.deepEqual(replay, created);
    const duplicate = await call(ana, "create_list", { name: "domingo", idempotency_key: "list-domingo-2" });
    assert.equal(errorCode(duplicate), "validation");
    const owned = await db.select({ id: lists.id }).from(lists).where(and(eq(lists.userId, ana), eq(lists.name, "Domingo")));
    assert.equal(owned.length, 1);
  });

  it("add_to_list: forbidden as a viewer, works as an editor and saves the film for the person", async () => {
    const asViewer = await call(ana, "add_to_list", { list_id: viewerList, id: film.catalogId, idempotency_key: "addl-viewer-1" });
    assert.equal(errorCode(asViewer), "forbidden");
    const asEditor = await call(ana, "add_to_list", { list_id: editorList, id: other.catalogId, idempotency_key: "addl-editor-1" });
    assert.equal(asEditor.newly_added, true);
    const items = await db.select().from(listItems).where(eq(listItems.listId, editorList));
    assert.deepEqual(items.map((item) => [item.catalogId, item.addedByUserId]), [[other.catalogId, ana]]);
    assert.ok(await ownTitle(ana, other.catalogId), "a film added to a list is saved in the library");
    const hidden = await seed.collection(leo, "Privada de Leo");
    const notShared = await call(ana, "add_to_list", { list_id: hidden, id: film.catalogId, idempotency_key: "addl-hidden-1" });
    assert.equal(errorCode(notShared), "not_found");
  });

  it("remove_from_list needs confirm, then removes only from the list", async () => {
    const unconfirmed = await call(ana, "remove_from_list", { list_id: editorList, id: other.catalogId });
    assert.equal(errorCode(unconfirmed), "confirmation_required");
    assert.equal((await db.select().from(listItems).where(eq(listItems.listId, editorList))).length, 1);
    const removed = await call(ana, "remove_from_list", { list_id: editorList, id: other.catalogId, confirm: true });
    assert.equal(removed.removed, true);
    assert.equal((await db.select().from(listItems).where(eq(listItems.listId, editorList))).length, 0);
    assert.ok(await ownTitle(ana, other.catalogId), "the title stays in the library");
    const asViewer = await call(ana, "remove_from_list", { list_id: viewerList, id: other.catalogId, confirm: true });
    assert.equal(errorCode(asViewer), "forbidden");
  });

  it("get_watch_together refuses a list where the person only reads", async () => {
    const data = await call(ana, "get_watch_together", { list_id: viewerList });
    assert.equal(errorCode(data), "forbidden");
  });
});
