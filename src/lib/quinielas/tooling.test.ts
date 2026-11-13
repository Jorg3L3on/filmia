import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { skeletonCeremony, validateCeremonyFile, type QuinielaCeremonyFile } from "@/lib/quinielas/ceremony-core";
import { fillCeremonyFromTmdb } from "@/lib/quinielas/tooling";

/** A Globos file as it is typed by hand: films and series, some with IMDb ids, some only titles. */
const globos = (): QuinielaCeremonyFile => {
  const file = skeletonCeremony({ award: "globos", year: 2127, nominationsOn: "2126-12-07", ceremonyOn: "2127-01-10", builtAt: "x" });
  const take = (id: string) => file.categories.find((category) => category.id === id)!;
  file.categories = [
    {
      ...take("pelicula-drama"),
      nominees: [
        { id: "tt1000001", work: { title: "Film One", kind: "movie", imdbId: "tt1000001" } },
        { id: "film-two", work: { title: "Film Two", kind: "movie", imdbId: null } },
      ],
    },
    {
      ...take("serie-drama"),
      nominees: [
        { id: "tt2000001", work: { title: "Show One", kind: "tv", imdbId: "tt2000001" } },
        { id: "show-lost", work: { title: "Nobody Knows This Show", kind: "tv", imdbId: null } },
      ],
    },
    {
      ...take("actriz-serie-drama"),
      nominees: [
        { id: "nm3000001", work: { title: "Show One", kind: "tv", imdbId: "tt2000001" }, person: { name: "Actress One", imdbId: "nm3000001" } },
        { id: "actress-two", work: { title: "Show Two", kind: "tv", imdbId: null }, person: { name: "Actress Two", imdbId: null } },
      ],
    },
  ];
  return file;
};

/** Fake TMDB: answers by path and query, records every URL. */
const fakeTmdb = () => {
  const urls: URL[] = [];
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const fetchImpl = async (raw: string) => {
    const url = new URL(raw);
    urls.push(url);
    const q = url.searchParams.get("query");
    switch (url.pathname) {
      case "/3/find/tt1000001":
        return json({ movie_results: [{ id: 11, title: "Película Uno", poster_path: "/p1.jpg" }], tv_results: [] });
      case "/3/find/tt2000001":
        return json({ movie_results: [], tv_results: [{ id: 21, name: "Serie Uno", poster_path: "/s1.jpg" }] });
      case "/3/find/nm3000001":
        return json({ person_results: [{ id: 31, profile_path: "/a1.jpg" }] });
      case "/3/search/movie":
        return json({ results: q === "Film Two" ? [{ id: 12, title: "Película Dos", poster_path: "/p2.jpg" }] : [] });
      case "/3/search/tv":
        return json({ results: q === "Show Two" ? [{ id: 22, name: "Serie Dos", poster_path: "/s2.jpg" }] : [] });
      case "/3/search/person":
        return json({ results: q === "Actress Two" ? [{ id: 32, profile_path: null }] : [] });
      default:
        return new Response("not found", { status: 404 });
    }
  };
  return { urls, fetchImpl };
};

describe("quiniela:tmdb (FIL-I51-9)", () => {
  it("fills films and series by IMDb id or title, people too, and lists what it did not find", async () => {
    const file = globos();
    const tmdb = fakeTmdb();
    const report = await fillCeremonyFromTmdb(file, "key", tmdb.fetchImpl);
    const works = file.categories.flatMap((category) => category.nominees.map((nominee) => [nominee.id, nominee.work.tmdbId ?? null, nominee.work.titleEs ?? null, nominee.work.posterPath ?? null]));
    assert.deepEqual(works, [
      ["tt1000001", 11, "Película Uno", "/p1.jpg"],
      ["film-two", 12, "Película Dos", "/p2.jpg"],
      ["tt2000001", 21, "Serie Uno", "/s1.jpg"],
      ["show-lost", null, null, null],
      ["nm3000001", 21, "Serie Uno", "/s1.jpg"],
      ["actress-two", 22, "Serie Dos", "/s2.jpg"],
    ]);
    assert.deepEqual(
      file.categories[2]!.nominees.map((nominee) => [nominee.person?.tmdbId, nominee.person?.profilePath]),
      [
        [31, "/a1.jpg"],
        [32, null],
      ],
    );
    assert.deepEqual(report.missing, ["serie-drama/show-lost: Nobody Knows This Show"]);
    assert.equal(report.filled, 5);
    // Films are searched with the year before the ceremony; series without a year; all in es-MX.
    const filmSearch = tmdb.urls.find((url) => url.pathname === "/3/search/movie")!;
    assert.equal(filmSearch.searchParams.get("year"), "2126");
    assert.equal(tmdb.urls.find((url) => url.pathname === "/3/search/tv")!.searchParams.get("year"), null);
    assert.ok(tmdb.urls.every((url) => url.searchParams.get("language") === "es-MX"));
    // The same IMDb id is asked once.
    assert.equal(tmdb.urls.filter((url) => url.pathname === "/3/find/tt2000001").length, 1);
    assert.deepEqual(validateCeremonyFile(file), []);
  });

  it("keeps what the file already has", async () => {
    const file = globos();
    file.categories[0]!.nominees[0]!.work = { title: "Film One", kind: "movie", imdbId: "tt1000001", tmdbId: 99, titleEs: "Mi título", posterPath: "/mio.jpg" };
    const tmdb = fakeTmdb();
    await fillCeremonyFromTmdb(file, "key", tmdb.fetchImpl);
    assert.deepEqual(file.categories[0]!.nominees[0]!.work, { title: "Film One", kind: "movie", imdbId: "tt1000001", tmdbId: 99, titleEs: "Mi título", posterPath: "/mio.jpg" });
    assert.ok(!tmdb.urls.some((url) => url.pathname === "/3/find/tt1000001"));
  });
});
