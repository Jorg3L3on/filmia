import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const titleKindEnum = pgEnum("TitleKind", ["MOVIE", "SERIES"]);
export const seriesStatusEnum = pgEnum("SeriesStatus", [
  "WATCHING",
  "FINISHED",
  "DROPPED",
]);
export const platformEnum = pgEnum("Platform", [
  "NETFLIX",
  "PRIME",
  "MAX",
  "DISNEY",
  "CLARO",
  "APPLE",
  "MUBI",
  "PARAMOUNT",
  "CRUNCHYROLL",
  "VIX",
  "PLUTO",
  "AMCPLUS",
  "CURIOSITY",
  "LIONSGATE",
]);
export const listKindEnum = pgEnum("ListKind", ["COLLECTION", "WATCHLIST"]);

const enumObject = <T extends string>(values: readonly T[]) =>
  Object.fromEntries(values.map((value) => [value, value])) as { [K in T]: K };

export type TitleKind = (typeof titleKindEnum.enumValues)[number];
export const TitleKind = enumObject(titleKindEnum.enumValues);

export type SeriesStatus = (typeof seriesStatusEnum.enumValues)[number];
export const SeriesStatus = enumObject(seriesStatusEnum.enumValues);

export type Platform = (typeof platformEnum.enumValues)[number];
export const Platform = enumObject(platformEnum.enumValues);

export type ListKind = (typeof listKindEnum.enumValues)[number];
export const ListKind = enumObject(listKindEnum.enumValues);

export const users = pgTable(
  "User",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    /** Null for accounts that only sign in with Google. */
    passwordHash: text("passwordHash"),
    /** Google `sub` claim; set when the account signs in with Google. */
    googleId: text("googleId"),
    name: text("name"),
    streamingPlatforms: jsonb("streamingPlatforms").notNull().default([]),
    /** `{ weekday: "23:30", weekend: "01:00" }` — when the night ends (Esta noche fit). */
    nightEndsAt: jsonb("nightEndsAt").notNull().default({}),
    /** Bienvenida finished or skipped; null = still gated to /bienvenida. Backfilled = createdAt for older accounts. */
    onboardedAt: timestamp("onboardedAt", { precision: 3, mode: "date" }),
    /** Resume pointer (OnboardingStepId) while the Bienvenida is in progress. */
    onboardingStep: text("onboardingStep"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("User_email_key").on(table.email),
    index("User_email_idx").on(table.email),
    uniqueIndex("User_googleId_key").on(table.googleId),
  ],
);

/**
 * One row per film/series, shared by every user and keyed by `(tmdbId, kind)`.
 * Holds everything that comes from TMDB/OMDb or is derived from it; users never
 * edit it. Personal data (rating, review, watchedAt…) lives on `Title`.
 */
export const catalog = pgTable(
  "Catalog",
  {
    id: text("id").primaryKey(),
    tmdbId: integer("tmdbId").notNull(),
    kind: titleKindEnum("kind").notNull(),
    name: text("name").notNull(),
    originalName: text("originalName"),
    year: integer("year"),
    posterPath: text("posterPath"),
    backdropPath: text("backdropPath"),
    runtimeMinutes: integer("runtimeMinutes"),
    imdbId: text("imdbId"),
    imdbRating: real("imdbRating"),
    imdbVotes: integer("imdbVotes"),
    /** OMDb `Awards` text, e.g. "Won 2 Oscars. 23 wins & 12 nominations total." */
    awards: text("awards"),
    overview: text("overview"),
    tmdbGenres: jsonb("tmdbGenres").notNull().default([]),
    /** Esta noche (Hoy): TMDB keywords `[{ id, name }]` for the taste vector. */
    tmdbKeywords: jsonb("tmdbKeywords").notNull().default([]),
    /** Esta noche: `[{ id, name, role: "director" | "creator" | "cast" }]`. */
    tmdbPeople: jsonb("tmdbPeople").notNull().default([]),
    originalLanguage: text("originalLanguage"),
    watchProvidersMx: jsonb("watchProvidersMx"),
    watchProvidersFetchedAt: timestamp("watchProvidersFetchedAt", {
      precision: 3,
      mode: "date",
    }),
    /** First time we saw a flatrate MX offer — drives «Acaba de llegar». */
    availableSince: timestamp("availableSince", { precision: 3, mode: "date" }),
    /** Space-separated RGB (`"122 146 172"`) sampled server-side for the sala glow. */
    posterAmbient: text("posterAmbient"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("Catalog_tmdbId_kind_key").on(table.tmdbId, table.kind),
    index("Catalog_imdbId_idx").on(table.imdbId),
    index("Catalog_watchProvidersFetchedAt_idx").on(table.watchProvidersFetchedAt),
  ],
);

/**
 * A user's entry for one catalog film: everything personal (rating, review,
 * where they watched it, when, series progress). The film itself — name,
 * poster, credits, availability… — lives on `Catalog`; reads flatten the two
 * with `flattenTitle`. One entry per film per user.
 */
export const titles = pgTable(
  "Title",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    catalogId: text("catalogId")
      .notNull()
      .references(() => catalog.id),
    rating: integer("rating"),
    review: text("review"),
    platform: platformEnum("platform"),
    watchedAt: timestamp("watchedAt", { precision: 3, mode: "date" }),
    seriesStatus: seriesStatusEnum("seriesStatus"),
    seriesSeason: integer("seriesSeason"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("Title_userId_idx").on(table.userId),
    index("Title_catalogId_idx").on(table.catalogId),
    uniqueIndex("Title_userId_catalogId_key").on(table.userId, table.catalogId),
    index("Title_userId_watchedAt_idx").on(table.userId, table.watchedAt),
    index("Title_rating_idx").on(table.rating),
    index("Title_seriesStatus_idx").on(table.seriesStatus),
    index("Title_userId_seriesStatus_idx").on(table.userId, table.seriesStatus),
  ],
);

export const lists = pgTable(
  "List",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    kind: listKindEnum("kind").notNull().default("COLLECTION"),
    slug: text("slug"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("List_userId_slug_key").on(table.userId, table.slug),
    index("List_userId_idx").on(table.userId),
    index("List_kind_idx").on(table.kind),
  ],
);

export const listItems = pgTable(
  "ListItem",
  {
    listId: text("listId")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    titleId: text("titleId")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    queueNote: text("queueNote"),
    addedAt: timestamp("addedAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.listId, table.titleId] }),
    index("ListItem_listId_position_idx").on(table.listId, table.position),
  ],
);

/** Precomputed «Esta noche» decks per user (Hoy). Fit with the clock is applied at read time. */
export const tonightPicks = pgTable(
  "TonightPick",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: text("titleId")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    lens: text("lens").notNull(),
    lensName: text("lensName").notNull(),
    lensRank: integer("lensRank").notNull().default(0),
    rank: integer("rank").notNull().default(0),
    score: real("score").notNull().default(0),
    components: jsonb("components").notNull().default({}),
    reasons: jsonb("reasons").notNull().default([]),
    wildcard: integer("wildcard").notNull().default(0),
    computedAt: timestamp("computedAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.lens, table.titleId] }),
    index("TonightPick_userId_lensRank_rank_idx").on(table.userId, table.lensRank, table.rank),
  ],
);

/** Feedback for Esta noche: impressions, skips, «Ahora no», opens, Más/Menos así. */
export const pickEvents = pgTable(
  "PickEvent",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: text("titleId")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    lens: text("lens"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("PickEvent_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("PickEvent_userId_titleId_idx").on(table.userId, table.titleId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  titles: many(titles),
  lists: many(lists),
}));

export const catalogRelations = relations(catalog, ({ many }) => ({
  titles: many(titles),
}));

export const titlesRelations = relations(titles, ({ one, many }) => ({
  user: one(users, { fields: [titles.userId], references: [users.id] }),
  catalog: one(catalog, { fields: [titles.catalogId], references: [catalog.id] }),
  listItems: many(listItems),
}));

export const listsRelations = relations(lists, ({ one, many }) => ({
  user: one(users, { fields: [lists.userId], references: [users.id] }),
  items: many(listItems),
}));

export const listItemsRelations = relations(listItems, ({ one }) => ({
  list: one(lists, { fields: [listItems.listId], references: [lists.id] }),
  title: one(titles, { fields: [listItems.titleId], references: [titles.id] }),
}));

export type User = typeof users.$inferSelect;
export type CatalogRow = typeof catalog.$inferSelect;
/** The personal row as stored. */
export type UserTitle = typeof titles.$inferSelect;
/** What `Catalog` contributes to a flattened title. */
export type CatalogFields = Omit<CatalogRow, "id" | "createdAt" | "updatedAt">;
/**
 * What the app works with: the personal row with its shared catalog spread on
 * top (see `flattenTitle`). Components never see the two tables separately.
 */
export type Title = UserTitle & CatalogFields & { catalogId: string };
export type List = typeof lists.$inferSelect;
export type ListItem = typeof listItems.$inferSelect;
export type TonightPickRow = typeof tonightPicks.$inferSelect;
export type PickEventRow = typeof pickEvents.$inferSelect;

export type ListItemWithTitleRelations = typeof listItems.$inferSelect & {
  title: Title;
};

export type TitleWithRelations = Title & {
  listItems: (typeof listItems.$inferSelect & { list: List })[];
};
