import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { registerCeremonyForTests } from "@/lib/quinielas/ceremonies";
import { skeletonCeremony, validateCeremonyFile, type QuinielaCeremonyFile } from "@/lib/quinielas/ceremony-core";
import { loadCategories } from "@/lib/quinielas/ballot-load";
import { findTmdbWorkByImdbId } from "@/lib/tmdb";

/** A fake Emmy ceremony (series and people in series), written the way a hand-made file is: no TMDB fields. */
const emmyFixture = (): QuinielaCeremonyFile => {
  const file = skeletonCeremony({ award: "emmy", year: 2125, nominationsOn: "2125-07-15", ceremonyOn: "2125-09-14", builtAt: "x" });
  const series = (id: string, title: string) => ({ id, work: { title, kind: "tv" as const, imdbId: id } });
  file.categories = [
    { ...file.categories.find((category) => category.id === "serie-drama")!, nominees: [series("tt0000001", "Serie Uno"), series("tt0000002", "Serie Dos")] },
    {
      ...file.categories.find((category) => category.id === "actriz-drama")!,
      nominees: [
        { id: "nm0000001", work: { title: "Serie Uno", kind: "tv", imdbId: "tt0000001" }, person: { name: "Actriz Uno", imdbId: "nm0000001" } },
        { id: "nm0000002", work: { title: "Serie Dos", kind: "tv", imdbId: "tt0000002" }, person: { name: "Actriz Dos", imdbId: "nm0000002" } },
      ],
    },
  ];
  return file;
};

const realFetch = globalThis.fetch;
const realKey = process.env.TMDB_API_KEY;
const calls: string[] = [];

describe("quinielas/series from TMDB (FIL-I51-7)", () => {
  before(() => {
    process.env.TMDB_API_KEY = "test-key";
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      calls.push(url.pathname);
      const id = url.pathname.split("/").pop();
      const body =
        id === "tt0000001"
          ? { movie_results: [], tv_results: [{ id: 101, name: "Serie Uno (MX)", poster_path: "/uno.jpg" }] }
          : id === "tt0000002"
            ? { movie_results: [], tv_results: [{ id: 102, name: "Serie Dos (MX)", poster_path: "/dos.jpg" }] }
            : { movie_results: [{ id: 9, title: "Una película", poster_path: "/peli.jpg" }], tv_results: [] };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
  });

  after(() => {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = realKey;
  });

  it("the hand-written Emmy fixture is a valid ceremony", () => {
    assert.deepEqual(validateCeremonyFile(emmyFixture()), []);
  });

  it("finds series through tv_results and films through movie_results", async () => {
    assert.deepEqual(await findTmdbWorkByImdbId("tt0000001", "tv"), {
      kind: "tv",
      tmdbId: 101,
      title: "Serie Uno (MX)",
      posterPath: "/uno.jpg",
    });
    assert.equal((await findTmdbWorkByImdbId("tt0000009", "movie"))?.kind, "movie");
    // A hand-made file that says «movie» for a series still finds it.
    assert.equal((await findTmdbWorkByImdbId("tt0000002", "movie"))?.tmdbId, 102);
    assert.equal(await findTmdbWorkByImdbId("nm0000001", "tv"), null);
  });

  it("the ballot fills series posters and Mexican titles at read time", async () => {
    registerCeremonyForTests("emmy-2125", "oscar-2024", emmyFixture());
    const categories = await loadCategories("emmy-2125");
    const drama = categories!.find((category) => category.id === "serie-drama")!;
    assert.deepEqual(
      drama.nominees.map((nominee) => [nominee.name, nominee.posterPath]),
      [
        ["Serie Uno (MX)", "/uno.jpg"],
        ["Serie Dos (MX)", "/dos.jpg"],
      ],
    );
    const actress = categories!.find((category) => category.id === "actriz-drama")!;
    assert.deepEqual(actress.nominees[0], { id: "nm0000001", name: "Actriz Uno", detail: "Serie Uno (MX)", posterPath: "/uno.jpg" });
    assert.ok(calls.every((path) => path.startsWith("/3/find/tt")));
  });
});
