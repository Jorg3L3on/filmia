import { describeWithDb, testDatabaseUrl } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createId } from "@paralleldrive/cuid2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { lists } from "@/db";
import { db } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { AdminPanel } from "@/components/admin/AdminPanel";
import {
  fillUsageDays,
  loadAdminUsers,
  loadApiUsage,
  quotaTone,
  sortAdminUsers,
  type AdminUserRow,
} from "@/lib/admin-stats";
import { bumpApiUsage, utcDay } from "@/lib/api-usage";
import { seeder } from "@/lib/test-support/seed";

const NOW = new Date("2026-10-29T20:00:00Z");

const row = (id: string, createdAt: string, lastActiveAt: string | null): AdminUserRow => ({
  id,
  email: `${id}@ejemplo.com`,
  name: id,
  createdAt: new Date(createdAt),
  lastActiveAt: lastActiveAt ? new Date(lastActiveAt) : null,
  titles: 0,
  watched: 0,
  liked: 0,
  lists: 0,
});

describe("Admin · stats (FIL-I37-3)", () => {
  it("quota tone: green < 70 %, amber 70–90 %, red > 90 %", () => {
    assert.deepEqual([0, 699, 700, 900, 901, 1000].map((used) => quotaTone(used)), ["ok", "ok", "warn", "warn", "danger", "danger"]);
  });

  it("fills seven UTC days, today first, zeros where nothing was called", () => {
    const days = fillUsageDays(
      [
        { provider: "omdb", day: "2026-10-29", count: 412 },
        { provider: "tmdb", day: "2026-10-29", count: 2318 },
        { provider: "omdb", day: "2026-10-27", count: 5 },
        { provider: "omdb", day: "2026-10-01", count: 999 },
      ],
      NOW,
    );
    assert.equal(days.length, 7);
    assert.deepEqual(days[0], { day: "2026-10-29", omdb: 412, tmdb: 2318 });
    assert.deepEqual(days[2], { day: "2026-10-27", omdb: 5, tmdb: 0 });
    assert.equal(days[6].day, "2026-10-23");
  });

  it("sorts by last activity, never-seen accounts last", () => {
    const sorted = sortAdminUsers([
      row("nunca", "2026-10-20", null),
      row("ayer", "2026-09-01", "2026-10-28T10:00:00Z"),
      row("hoy", "2026-08-01", "2026-10-29T19:00:00Z"),
      row("nunca-viejo", "2026-01-01", null),
    ]);
    assert.deepEqual(
      sorted.map((user) => user.id),
      ["hoy", "ayer", "nunca", "nunca-viejo"],
    );
  });

  it("renders «—» when ApiUsage and lastActiveAt are not there yet", () => {
    const html = renderToStaticMarkup(
      createElement(AdminPanel, {
        usage: null,
        users: { rows: [row("ana", "2026-09-03", null)], lastActiveMissing: true },
        now: NOW,
      }),
    );
    assert.match(html, /Sin contador todavía: falta la tabla ApiUsage \(0026\)/);
    assert.match(html, /hasta aplicar 0025/);
    assert.match(html, /ana@ejemplo\.com/);
    assert.doesNotMatch(html, /\/ 1,000/);
  });

  it("renders today's quota with its tone", () => {
    const usage = fillUsageDays([{ provider: "omdb", day: "2026-10-29", count: 962 }], NOW);
    const html = renderToStaticMarkup(
      createElement(AdminPanel, { usage, users: { rows: [], lastActiveMissing: false }, now: NOW }),
    );
    assert.match(html, /962/);
    assert.match(html, /96 %/);
    assert.match(html, /bg-danger/);
    assert.match(html, /Quedan 38/);
  });
});

describe("Admin · stats without a database (FIL-I37-3)", { skip: Boolean(testDatabaseUrl) }, () => {
  it("loadApiUsage answers null instead of failing when the table cannot be read", async () => {
    assert.equal(await loadApiUsage(NOW), null);
  });
});

const seed = seeder("admin");

describeWithDb("Admin · counts on fixtures (FIL-I37-3)", () => {
  let ana = "";
  let luis = "";

  before(async () => {
    ana = await seed.user("Ana");
    luis = await seed.user("Luis");
    const films = await Promise.all(["Uno", "Dos", "Tres", "Cuatro"].map((name) => seed.film({ name })));
    await seed.title(ana, films[0].catalogId, { watchedAt: new Date(), rating: 10 });
    await seed.title(ana, films[1].catalogId, { watchedAt: new Date(), rating: 8 });
    await seed.title(ana, films[2].catalogId, { watchedAt: new Date(), rating: 6 });
    await seed.title(ana, films[3].catalogId);
    await seed.title(luis, films[0].catalogId, { rating: 7 });
    await db.insert(lists).values([
      { id: createId(), userId: ana, name: "Domingos" },
      { id: createId(), userId: ana, name: "Para mamá" },
    ]);
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("counts títulos, vistos, gustados (4★+) and lists they made", async () => {
    const { rows, lastActiveMissing } = await loadAdminUsers();
    assert.equal(lastActiveMissing, false);
    const pick = (id: string) => {
      const user = rows.find((candidate) => candidate.id === id)!;
      return { titles: user.titles, watched: user.watched, liked: user.liked, lists: user.lists };
    };
    assert.deepEqual(pick(ana), { titles: 4, watched: 3, liked: 2, lists: 2 });
    assert.deepEqual(pick(luis), { titles: 1, watched: 0, liked: 0, lists: 0 });
  });

  it("reads today's counter", async () => {
    const before = (await loadApiUsage())?.[0].omdb ?? 0;
    await bumpApiUsage("omdb", utcDay());
    await bumpApiUsage("omdb", utcDay());
    const usage = await loadApiUsage();
    assert.ok(usage);
    assert.equal(usage[0].omdb, before + 2);
  });
});
