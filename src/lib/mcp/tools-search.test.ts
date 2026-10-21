import { describeWithDb } from "@/lib/test-support/local-db";
import "@/lib/test-support/oauth";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, it } from "node:test";
import Ajv from "ajv";
import { closeLocalPg } from "@/db/local-pg";
import { mcpTestbed, toolData } from "@/lib/test-support/mcp";
import { seeder } from "@/lib/test-support/seed";
import { TEST_ISSUER } from "@/lib/test-support/oauth";
import { executeTool, type ToolDefinition } from "./define-tool";
import { mcpToolDefinitions } from "./server";

const tool = (name: string) => mcpToolDefinitions().find((definition) => definition.name === name) as ToolDefinition;

describeWithDb("search and fetch with the ChatGPT shape (FIL-I20-4)", () => {
  const seed = seeder("t-search");
  const bed = mcpTestbed();
  let ana: string;
  let leo: string;
  let pastLives: { catalogId: string; tmdbId: number };
  let leoList: string;
  const outbound: string[] = [];
  const realFetch = globalThis.fetch;
  const realKey = process.env.TMDB_API_KEY;

  const call = async (userId: string, name: string, args: Record<string, unknown>) =>
    toolData<Record<string, unknown>>(
      await executeTool(
        tool(name),
        bed.tools,
        {
          userId,
          source: "oauth",
          connectionId: `conn-${userId}`,
          clientName: "ChatGPT",
          scopes: ["read"],
          canWrite: false,
          expiresAt: new Date("2030-01-01T00:00:00Z"),
        },
        args,
      ),
    );

  before(async () => {
    ana = await seed.user("Ana", ["NETFLIX"]);
    leo = await seed.user("Leo", ["NETFLIX"]);
    pastLives = await seed.film({ name: "Past Lives", year: 2023, runtime: 106, platforms: ["MUBI"] });
    await seed.title(ana, pastLives.catalogId, { watchedAt: new Date("2025-03-02T12:00:00Z"), rating: 9 });
    leoList = await seed.collection(leo, "Past Lives y otras");
    await seed.addToList(leoList, pastLives.catalogId, leo);

    // TMDB answers from a stub; any OMDb request would be counted.
    process.env.TMDB_API_KEY = "test-key";
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      outbound.push(url);
      if (url.includes("themoviedb.org/3/search/multi")) {
        return Response.json({
          results: [
            { id: pastLives.tmdbId, media_type: "movie", title: "Past Lives", release_date: "2023-06-02" },
            { id: 4242, media_type: "movie", title: "Past Lives: la otra", release_date: "2024-01-01" },
          ],
        });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
  });

  after(async () => {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = realKey;
    await seed.cleanup();
    await closeLocalPg();
  });

  it("finds the person's own title first, with an absolute url, and never someone else's list", async () => {
    const data = await call(ana, "search", { query: "Past Lives" });
    const results = data.results as { id: string; title: string; url: string }[];
    assert.equal(results[0]!.id, `title:${pastLives.catalogId}`);
    assert.match(results[0]!.title, /Past Lives \(2023\) · en tu biblioteca/);
    assert.ok(results[0]!.url.startsWith(`${TEST_ISSUER}/titulos/`));
    assert.equal(results.filter((result) => result.id.endsWith(String(pastLives.tmdbId))).length, 0, "no duplicate");
    assert.ok(results.some((result) => result.id === "title:tmdb:movie:4242"));
    assert.equal(results.some((result) => result.id.startsWith("list:")), false);
    const leoView = (await call(leo, "search", { query: "Past Lives" })).results as { id: string }[];
    assert.ok(leoView.some((result) => result.id === `list:${leoList}`));
  });

  it("fetches every kind of id, and answers not_found for someone else's", async () => {
    const titleDoc = await call(ana, "fetch", { id: `title:${pastLives.catalogId}` });
    assert.match(titleDoc.text as string, /Ya la vio\./);
    assert.match(titleDoc.text as string, /4\.5 de 5 estrellas/);
    const listDoc = await call(leo, "fetch", { id: `list:${leoList}` });
    assert.match(listDoc.text as string, /1\. Past Lives \(2023\)/);
    const diaryDoc = await call(ana, "fetch", { id: "diary:2025-03" });
    assert.match(diaryDoc.text as string, /2025-03-02 · Past Lives/);
    const tmdbDoc = await call(ana, "fetch", { id: `title:tmdb:movie:${pastLives.tmdbId}` });
    assert.equal(tmdbDoc.title, "Past Lives (2023)");

    const foreign = await call(ana, "fetch", { id: `list:${leoList}` });
    assert.equal((foreign.error as { code: string }).code, "not_found");
    const unknown = await call(ana, "fetch", { id: "title:zzzzzzzzzzzzzzzzzzzzzzzz" });
    assert.equal((unknown.error as { code: string }).code, "not_found");
  });

  it("validates against OpenAI's search and fetch schemas", async () => {
    const schemas = JSON.parse(await readFile(new URL("./openai-search-fetch.schema.json", import.meta.url), "utf8"));
    const ajv = new Ajv();
    const search = await call(ana, "search", { query: "Past Lives" });
    assert.ok(ajv.validate(schemas.search, search), JSON.stringify(ajv.errors));
    for (const id of [`title:${pastLives.catalogId}`, "diary:2025-03"]) {
      const doc = await call(ana, "fetch", { id });
      assert.ok(ajv.validate(schemas.fetch, doc), `${id}: ${JSON.stringify(ajv.errors)}`);
    }
  });

  it("never calls OMDb", async () => {
    await call(ana, "search", { query: "Past Lives" });
    await call(ana, "fetch", { id: `title:${pastLives.catalogId}` });
    assert.ok(outbound.some((url) => url.includes("themoviedb.org")), "TMDB stub was used");
    assert.equal(outbound.filter((url) => url.includes("omdbapi.com")).length, 0);
  });
});
