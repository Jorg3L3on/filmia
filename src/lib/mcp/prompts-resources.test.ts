import { describeWithDb } from "@/lib/test-support/local-db";
import "@/lib/test-support/oauth";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { closeLocalPg } from "@/db/local-pg";
import { mcpTestbed } from "@/lib/test-support/mcp";
import { seeder } from "@/lib/test-support/seed";

describe("prompts (FIL-I20-8)", () => {
  it("lists the three prompts and renders them with their arguments", async () => {
    const bed = mcpTestbed();
    const client = await bed.connect(await bed.personalToken("user-ana"));
    const listed = await client.listPrompts();
    assert.deepEqual(listed.prompts.map((prompt) => prompt.name).sort(), ["lista_para", "que_vemos_hoy", "resumen_del_mes"]);

    const tonight = await client.getPrompt({ name: "que_vemos_hoy", arguments: { plataforma: "Netflix", duracion_max: "120" } });
    const tonightText = (tonight.messages[0]!.content as { text: string }).text;
    assert.match(tonightText, /recommend con la plataforma Netflix y max_runtime_min 120/);

    const month = await client.getPrompt({ name: "resumen_del_mes", arguments: { mes: "2026-09" } });
    assert.match((month.messages[0]!.content as { text: string }).text, /list_diary con month 2026-09/);

    const list = await client.getPrompt({ name: "lista_para", arguments: { ocasion: "el domingo con mis papás" } });
    assert.match((list.messages[0]!.content as { text: string }).text, /el domingo con mis papás[\s\S]*create_list[\s\S]*add_to_list/);
    await client.close();
  });
});

describeWithDb("resources (FIL-I20-8)", () => {
  const seed = seeder("t-res");
  const bed = mcpTestbed();
  let ana: string;
  let leo: string;
  let mine: string;
  let shared: string;
  let hidden: string;

  before(async () => {
    ana = await seed.user("Ana", ["NETFLIX", "MUBI"]);
    leo = await seed.user("Leo", ["NETFLIX"]);
    mine = await seed.collection(ana, "Mi lista de Ana");
    shared = await seed.collection(leo, "De Leo para Ana", [{ userId: ana, role: "VIEWER" }]);
    hidden = await seed.collection(leo, "Solo de Leo");
    const loved = await seed.film({ name: "Amada", genres: ["Romance"] });
    await seed.title(ana, loved.catalogId, { watchedAt: new Date("2026-10-01T12:00:00Z"), rating: 10 });
    await seed.addToList(shared, loved.catalogId, leo);
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("lists only the person's own and shared lists, and refuses someone else's", async () => {
    const client = await bed.connect(await bed.personalToken(ana));
    const templates = await client.listResourceTemplates();
    assert.ok(templates.resourceTemplates.some((template) => template.uriTemplate === "filmia://listas/{id}"));
    const resources = await client.listResources();
    const uris = resources.resources.map((resource) => resource.uri);
    assert.ok(uris.includes("filmia://perfil"));
    assert.ok(uris.includes(`filmia://listas/${mine}`));
    assert.ok(uris.includes(`filmia://listas/${shared}`));
    assert.equal(uris.includes(`filmia://listas/${hidden}`), false);

    const read = await client.readResource({ uri: `filmia://listas/${shared}` });
    assert.match((read.contents[0] as { text: string }).text, /1\. Amada/);
    await assert.rejects(client.readResource({ uri: `filmia://listas/${hidden}` }));

    const profile = JSON.parse(((await client.readResource({ uri: "filmia://perfil" })).contents[0] as { text: string }).text);
    assert.deepEqual(profile.platforms.map((platform: { id: string }) => platform.id), ["NETFLIX", "MUBI"]);
    assert.deepEqual(profile.favorite_genres, [{ name: "Romance", count: 1 }]);
    assert.equal(JSON.stringify(profile).includes("@"), false, "no e-mail");
    await client.close();
  });
});
