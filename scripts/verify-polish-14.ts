import { Platform, TitleKind } from "../src/generated/prisma/browser";
import { catalogHref } from "../src/lib/catalog-href";
import {
  countSheetFilters,
  parseCatalogOrder,
  parseKindFilter,
  parsePlatformFilters,
  sortCatalogItems,
  titleMatchesKind,
} from "../src/lib/catalog-filters";
import { formatStarScore, ratingToStars } from "../src/lib/labels";
import {
  membershipCopy,
  titleListMembership,
  WATCHLIST_MEMBERSHIP_SLUG,
} from "../src/lib/list-membership";
import { resolveCatalogAvailability } from "../src/lib/streaming-platforms";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

assert(parseKindFilter("MOVIE") === TitleKind.MOVIE, "kind MOVIE");
assert(parseKindFilter(["SERIES"]) === TitleKind.SERIES, "kind SERIES from array");
assert(parseKindFilter("nope") === "ALL", "unknown kind is ALL");

assert(
  JSON.stringify(parsePlatformFilters(["NETFLIX", "disney", "HULU"])) ===
    JSON.stringify([Platform.NETFLIX, Platform.DISNEY]),
  "platform filters keep catalog order and drop unknown",
);

assert(parseCatalogOrder("name") === "name", "order name");
assert(parseCatalogOrder("watched") === null, "watched is not a sheet order");

assert(
  countSheetFilters({
    platforms: [Platform.NETFLIX, Platform.MAX],
    sort: "rating",
    defaultSort: null,
    tags: ["sci-fi"],
    minePlatforms: false,
  }) === 4,
  "badge counts platforms + sort + tags",
);

assert(
  catalogHref("/watchlist", {
    kind: TitleKind.MOVIE,
    platforms: [Platform.NETFLIX],
    sort: "rating",
  }) === "/watchlist?sort=rating&kind=MOVIE&platform=NETFLIX",
  "catalog href encodes chips + sheet",
);

assert(titleMatchesKind(TitleKind.MOVIE, "ALL"), "ALL matches movie");
assert(!titleMatchesKind(TitleKind.MOVIE, TitleKind.SERIES), "series filter excludes movies");

const ranked = sortCatalogItems(
  [
    { name: "Zodiac", rating: 8, updatedAt: "2024-01-01" },
    { name: "Arrival", rating: 9, updatedAt: "2024-02-01" },
  ],
  "name",
);
assert(ranked[0]?.name === "Arrival", "sort by title");

assert(ratingToStars(9) === 4.5, "9/10 is 4.5 stars");
assert(formatStarScore(9) === "4.5", "Fraunces number is 4.5");
assert(formatStarScore(10) === "5.0", "10/10 is 5.0");

const idle = titleListMembership([]);
assert(idle.state === "idle", "no lists is idle");
assert(membershipCopy(idle).label === "Quiero ver", "idle copy is Quiero ver");
assert(membershipCopy(idle).label !== "En lista", "idle never says En lista");

const queued = titleListMembership([
  { id: "w", name: "Quiero ver", slug: WATCHLIST_MEMBERSHIP_SLUG },
]);
assert(queued.state === "watchlist", "watchlist membership");
assert(membershipCopy(queued).label === "Quiero ver", "watchlist stays Quiero ver");
assert(membershipCopy(queued).label !== "En lista", "watchlist never says En lista");

const saved = titleListMembership([
  { id: "w", name: "Quiero ver", slug: WATCHLIST_MEMBERSHIP_SLUG },
  { id: "f", name: "Favoritas", slug: "favoritas" },
]);
assert(saved.state === "in-list" && saved.list.name === "Favoritas", "custom list wins");
assert(membershipCopy(saved).label === "En lista", "custom list copy");
assert(membershipCopy(saved).detail === "Favoritas", "custom list name");
assert(membershipCopy(saved).label !== "Quiero ver", "En lista never reuses Quiero ver");

const catalog = resolveCatalogAvailability(
  [
    {
      id: "1",
      watchProvidersMx: {
        fetchedAt: "2024-01-01",
        link: null,
        flatrate: [{ providerId: 8, name: "Netflix", logoPath: null, logoUrl: null }],
        rent: [],
        buy: [],
      },
    },
    {
      id: "2",
      watchProvidersMx: {
        fetchedAt: "2024-01-01",
        link: null,
        flatrate: [{ providerId: 337, name: "Disney Plus", logoPath: null, logoUrl: null }],
        rent: [],
        buy: [],
      },
    },
  ],
  { platforms: [Platform.NETFLIX] },
);
assert(catalog.titles.length === 1 && catalog.titles[0]?.id === "1", "MX platform filter");

console.log("✓ Polish 14: chips, membership copy, stars, empty helpers");
