import { slugify } from "../src/lib/labels";
import {
  catalogHref,
  DEFAULT_TAG_NAMES,
  parseTagSlugs,
  titleMatchesAnyTag,
} from "../src/lib/tags";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = () => {
  assert(
    JSON.stringify(parseTagSlugs("epica-guerra")) ===
      JSON.stringify(["epica-guerra"]),
    "A single tag query should stay a one-item list",
  );
  assert(
    JSON.stringify(parseTagSlugs(["sci-fi", "visual-espectaculo"])) ===
      JSON.stringify(["sci-fi", "visual-espectaculo"]),
    "Repeated ?tag= params should keep order and values",
  );
  assert(
    JSON.stringify(parseTagSlugs("epica-guerra,sci-fi, epica-guerra")) ===
      JSON.stringify(["epica-guerra", "sci-fi"]),
    "Comma-separated tags should de-dupe",
  );
  assert(parseTagSlugs(undefined).length === 0, "Missing tag param is empty");
  assert(parseTagSlugs(42).length === 0, "Non-string tag param is empty");

  const titles = [
    { tags: [{ tag: { slug: "epica-guerra" } }, { tag: { slug: "historico" } }] },
    { tags: [{ tag: { slug: "sci-fi" } }] },
    { tags: [] },
  ];

  assert(
    titleMatchesAnyTag(titles[0].tags, []),
    "No selected tags should match every title",
  );
  assert(
    titleMatchesAnyTag(titles[0].tags, ["sci-fi", "historico"]),
    "OR filter should match if any selected slug is present",
  );
  assert(
    !titleMatchesAnyTag(titles[1].tags, ["epica-guerra"]),
    "OR filter should exclude titles without any selected slug",
  );
  assert(
    !titleMatchesAnyTag(titles[2].tags, ["sci-fi"]),
    "A title with no tags should not match a tag filter",
  );

  assert(
    catalogHref("/", { tags: ["epica-guerra", "sci-fi"], view: "grid" }) ===
      "/?tag=epica-guerra&tag=sci-fi&view=grid",
    "Catalog href should emit repeated tag params and keep view",
  );
  assert(
    catalogHref("/listas/abc", { view: "deck" }) === "/listas/abc",
    "Default deck view should omit the query string",
  );
  assert(
    catalogHref("/tags/sci-fi", { sort: "watched", view: "grid" }) ===
      "/tags/sci-fi?view=grid&sort=watched",
    "Tag ranking href should keep sort and view",
  );

  for (const name of DEFAULT_TAG_NAMES) {
    const slug = slugify(name);
    assert(Boolean(slug), `Suggested tag “${name}” should slugify`);
  }

  assert(
    DEFAULT_TAG_NAMES.includes("Épica / guerra"),
    "Default tags should include Épica / guerra",
  );
  assert(
    DEFAULT_TAG_NAMES.includes("Visual / espectáculo"),
    "Default tags should include Visual / espectáculo",
  );

  console.log("✓ Tag parse, OR filter, catalog hrefs and suggested seeds");
};

run();
