import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { slugify } from "@/lib/labels";
import {
  FIXED_LIST_SLUGS,
  isFixedListSlug,
  isReservedListSlug,
  isSeriesStatusListSlug,
  SERIES_ABANDONADAS_SLUG,
  SERIES_EN_PROGRESO_SLUG,
  sortUserLists,
} from "@/lib/lists";
import {
  seriesStatusListSlug,
  seriesStatusListTransition,
} from "@/lib/series-status-lists";

describe("seriesStatusListSlug", () => {
  it("maps Viendo and Abandonada to their lists and Terminada to none", () => {
    assert.equal(seriesStatusListSlug("WATCHING"), SERIES_EN_PROGRESO_SLUG);
    assert.equal(seriesStatusListSlug("DROPPED"), SERIES_ABANDONADAS_SLUG);
    assert.equal(seriesStatusListSlug("FINISHED"), null);
    assert.equal(seriesStatusListSlug(null), null);
  });
});

describe("seriesStatusListTransition", () => {
  it("joins En progreso when starting to watch", () => {
    assert.deepEqual(seriesStatusListTransition(null, "WATCHING"), {
      join: SERIES_EN_PROGRESO_SLUG,
      leave: [SERIES_ABANDONADAS_SLUG],
      previous: null,
    });
  });

  it("moves from En progreso to Abandonadas", () => {
    assert.deepEqual(seriesStatusListTransition("WATCHING", "DROPPED"), {
      join: SERIES_ABANDONADAS_SLUG,
      leave: [SERIES_EN_PROGRESO_SLUG],
      previous: SERIES_EN_PROGRESO_SLUG,
    });
  });

  it("leaves every status list when finishing", () => {
    assert.deepEqual(seriesStatusListTransition("DROPPED", "FINISHED"), {
      join: null,
      leave: [SERIES_EN_PROGRESO_SLUG, SERIES_ABANDONADAS_SLUG],
      previous: SERIES_ABANDONADAS_SLUG,
    });
  });

  it("leaves every status list when clearing the status", () => {
    const transition = seriesStatusListTransition("WATCHING", null);
    assert.equal(transition.join, null);
    assert.deepEqual(transition.leave, [SERIES_EN_PROGRESO_SLUG, SERIES_ABANDONADAS_SLUG]);
    assert.equal(transition.previous, SERIES_EN_PROGRESO_SLUG);
  });

  it("is idempotent when repeating the same status", () => {
    const first = seriesStatusListTransition(null, "DROPPED");
    const again = seriesStatusListTransition("DROPPED", "DROPPED");
    assert.equal(again.join, first.join);
    assert.deepEqual(again.leave, first.leave);
    assert.equal(again.previous, null);
  });

  it("never joins and leaves the same list", () => {
    const statuses = [null, "WATCHING", "FINISHED", "DROPPED"] as const;
    for (const from of statuses) {
      for (const to of statuses) {
        const { join, leave } = seriesStatusListTransition(from, to);
        assert.ok(!join || !leave.includes(join), `${from} → ${to}`);
      }
    }
  });
});

describe("series status lists as fixed lists", () => {
  it("are fixed and reserved", () => {
    for (const slug of [SERIES_EN_PROGRESO_SLUG, SERIES_ABANDONADAS_SLUG]) {
      assert.ok(FIXED_LIST_SLUGS.includes(slug));
      assert.ok(isFixedListSlug(slug));
      assert.ok(isReservedListSlug(slug));
      assert.ok(isSeriesStatusListSlug(slug));
    }
    assert.ok(isReservedListSlug(slugify("Series abandonadas")));
    assert.ok(isReservedListSlug(slugify("Series en progreso")));
    assert.ok(!isSeriesStatusListSlug("favoritas"));
    assert.ok(!isSeriesStatusListSlug(null));
  });

  it("sort after the default daily lists and before custom ones", () => {
    const sorted = sortUserLists([
      { slug: null, name: "Animé" },
      { slug: SERIES_ABANDONADAS_SLUG, name: "Series abandonadas" },
      { slug: SERIES_EN_PROGRESO_SLUG, name: "Series en progreso" },
      { slug: "favoritas", name: "Favoritas" },
      { slug: "watchlist", name: "Quiero ver" },
    ]);
    assert.deepEqual(
      sorted.map((list) => list.slug),
      ["watchlist", "favoritas", SERIES_EN_PROGRESO_SLUG, SERIES_ABANDONADAS_SLUG, null],
    );
  });
});
