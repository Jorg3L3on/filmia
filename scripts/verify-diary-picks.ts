import {
  diaryHref,
  genreSlug,
  parseCategorySlug,
  parseStoredTmdbGenres,
  pickDiaryCategories,
  resolveDiaryCategory,
  titlesForDiaryCategory,
} from "../src/lib/diary-picks";
import { parseTmdbGenres } from "../src/lib/tmdb";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const title = (
  id: string,
  imdbRating: number | null,
  genres: Array<{ id: number; name: string }>,
) => ({
  id,
  imdbRating,
  tmdbGenres: genres,
});

const run = () => {
  assert(parseTmdbGenres(null).length === 0, "Null genres parse to empty");
  assert(
    parseStoredTmdbGenres([
      { id: 18, name: "Drama" },
      { id: 18, name: "Drama" },
      { id: 0, name: "Bad" },
      { name: "Nope" },
    ]).length === 1,
    "Duplicate and invalid genres are dropped",
  );
  assert(genreSlug("Ciencia ficción", 878) === "ciencia-ficcion", "Genre slug strips accents");
  assert(parseCategorySlug(["drama", "comedia"]) === "comedia", "Repeated categoria keeps last");
  assert(parseCategorySlug("  ") === null, "Blank categoria is ignored");
  assert(diaryHref("drama") === "/?categoria=drama", "Diary href encodes categoria");

  const titles = [
    title("a", 9.0, [
      { id: 18, name: "Drama" },
      { id: 28, name: "Acción" },
    ]),
    title("b", 8.5, [
      { id: 18, name: "Drama" },
      { id: 35, name: "Comedia" },
    ]),
    title("c", 8.1, [{ id: 35, name: "Comedia" }]),
    title("d", 7.6, [{ id: 35, name: "Comedia" }]),
    title("e", 7.4, [{ id: 28, name: "Acción" }]),
    title("f", 8.7, [{ id: 878, name: "Ciencia ficción" }]),
    title("g", null, [{ id: 18, name: "Drama" }]),
    title("h", 6.2, [{ id: 53, name: "Suspense" }]),
    title("i", 8.0, [
      { id: 18, name: "Drama" },
      { id: 878, name: "Ciencia ficción" },
    ]),
    title("j", 7.9, [{ id: 18, name: "Drama" }]),
    title("k", 7.2, [{ id: 18, name: "Drama" }]),
  ];

  const categories = pickDiaryCategories(titles);
  assert(categories.length === 4, `Expected 4 categories, got ${categories.length}`);
  assert(
    categories.map((category) => category.name).join(",") ===
      "Drama,Comedia,Ciencia ficción,Acción",
    `Top categories should prefer count then IMDb: ${categories.map((category) => category.name).join(",")}`,
  );
  assert(categories[0]?.count === 6, "Drama has the most titles");

  const drama = resolveDiaryCategory(categories, "drama");
  assert(drama?.name === "Drama", "Known slug resolves");
  assert(resolveDiaryCategory(categories, "nope")?.id === drama?.id, "Unknown slug falls back");
  assert(resolveDiaryCategory([], "drama") === null, "Empty categories resolve to null");

  const picks = titlesForDiaryCategory(titles, 18);
  assert(picks.length === 5, "Drama is capped at 5");
  assert(
    picks.map((item) => item.id).join(",") === "a,b,i,j,k",
    `Top IMDb first, nulls last: ${picks.map((item) => item.id).join(",")}`,
  );
  assert(
    !picks.some((item) => item.id === "g"),
    "Unrated drama should lose to scored titles when more than 5 exist",
  );

  const action = titlesForDiaryCategory(titles, 28);
  assert(action.length === 2, "Fewer than 5 titles stay unpadded");
  assert(action[0]?.id === "a" && action[1]?.id === "e", "Action order is IMDb desc");

  console.log("✓ Diary category ranking, slugs and top-5 IMDb picks");
};

run();
