import "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IMDB_ATTRIBUTION, ImdbAttribution } from "@/components/ImdbAttribution";
import { BestOfYearList } from "@/components/cine/BestOfYear";
import { CineActionsProvider } from "@/components/cine/CineActions";

// next/link needs a mounted app router, even on the server.
const noop = () => {};
const router = { back: noop, forward: noop, refresh: noop, push: noop, replace: noop, prefetch: noop, hmrRefresh: noop } as unknown as AppRouterInstance;

const Providers = ({ children }: { children?: ReactNode }) =>
  CineActionsProvider({ existing: [], lists: [], memberships: {}, pinnedTitleId: null, children });

const textOf = (html: string) => html.replace(/<[^>]+>/g, "");

describe("IMDb attribution (FIL-I35-4)", () => {
  it("renders the exact sentence with a link to https://www.imdb.com", () => {
    const html = renderToStaticMarkup(createElement(ImdbAttribution));
    assert.equal(IMDB_ATTRIBUTION, "Information courtesy of IMDb (https://www.imdb.com). Used with permission.");
    assert.equal(textOf(html), IMDB_ATTRIBUTION);
    assert.match(html, /<a href="https:\/\/www\.imdb\.com" target="_blank" rel="noopener noreferrer"/);
  });

  it("sits under «Lo mejor del año» once there is a ranking, not on the empty state", () => {
    const film = {
      rank: 1,
      catalogId: "c1",
      tmdbId: 1423191,
      name: "Resident Evil: Noche cero",
      originalName: null,
      year: 2026,
      posterPath: null,
      imdbRating: 7.5,
      imdbVotes: 118_021,
    };
    const list = (top: (typeof film)[]) =>
      textOf(
        renderToStaticMarkup(
          createElement(
            AppRouterContext.Provider,
            { value: router },
            createElement(
              Providers,
              null,
              createElement(BestOfYearList, { year: 2026, top, watchedIds: new Set<string>(), pending: false, pendingDay: null }),
            ),
          ),
        ),
      );
    const ranked = list([film]);
    assert.ok(ranked.includes("Resident Evil: Noche cero"));
    assert.ok(ranked.endsWith(IMDB_ATTRIBUTION));
    assert.ok(!list([]).includes("IMDb"));
  });

  it("is in Perfil's credits", async () => {
    const source = await readFile(new URL("../app/perfil/page.tsx", import.meta.url), "utf8");
    assert.match(source, /<ImdbAttribution \/>/);
  });
});
