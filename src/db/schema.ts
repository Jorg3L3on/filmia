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
    passwordHash: text("passwordHash").notNull(),
    name: text("name"),
    streamingPlatforms: jsonb("streamingPlatforms").notNull().default([]),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("User_email_key").on(table.email), index("User_email_idx").on(table.email)],
);

export const titles = pgTable(
  "Title",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    originalName: text("originalName"),
    kind: titleKindEnum("kind").notNull(),
    year: integer("year"),
    rating: integer("rating"),
    review: text("review"),
    platform: platformEnum("platform"),
    watchedAt: timestamp("watchedAt", { precision: 3, mode: "date" }),
    seriesStatus: seriesStatusEnum("seriesStatus"),
    seriesSeason: integer("seriesSeason"),
    tmdbId: integer("tmdbId"),
    posterPath: text("posterPath"),
    backdropPath: text("backdropPath"),
    runtimeMinutes: integer("runtimeMinutes"),
    imdbId: text("imdbId"),
    imdbRating: real("imdbRating"),
    overview: text("overview"),
    tmdbGenres: jsonb("tmdbGenres").notNull().default([]),
    watchProvidersMx: jsonb("watchProvidersMx"),
    watchProvidersFetchedAt: timestamp("watchProvidersFetchedAt", {
      precision: 3,
      mode: "date",
    }),
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
    index("Title_kind_idx").on(table.kind),
    index("Title_rating_idx").on(table.rating),
    index("Title_name_idx").on(table.name),
    index("Title_tmdbId_idx").on(table.tmdbId),
    index("Title_imdbId_idx").on(table.imdbId),
    index("Title_seriesStatus_idx").on(table.seriesStatus),
    index("Title_userId_seriesStatus_idx").on(table.userId, table.seriesStatus),
  ],
);

export const tags = pgTable(
  "Tag",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("Tag_userId_slug_key").on(table.userId, table.slug),
    index("Tag_userId_idx").on(table.userId),
  ],
);

export const titleTags = pgTable(
  "TitleTag",
  {
    titleId: text("titleId")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    tagId: text("tagId")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.titleId, table.tagId] })],
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

export const usersRelations = relations(users, ({ many }) => ({
  titles: many(titles),
  lists: many(lists),
  tags: many(tags),
}));

export const titlesRelations = relations(titles, ({ one, many }) => ({
  user: one(users, { fields: [titles.userId], references: [users.id] }),
  tags: many(titleTags),
  listItems: many(listItems),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, { fields: [tags.userId], references: [users.id] }),
  titles: many(titleTags),
}));

export const titleTagsRelations = relations(titleTags, ({ one }) => ({
  title: one(titles, { fields: [titleTags.titleId], references: [titles.id] }),
  tag: one(tags, { fields: [titleTags.tagId], references: [tags.id] }),
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
export type Title = typeof titles.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type List = typeof lists.$inferSelect;
export type ListItem = typeof listItems.$inferSelect;

export type TitleTagWithTag = typeof titleTags.$inferSelect & {
  tag: Tag;
};

export type ListItemWithTitleRelations = typeof listItems.$inferSelect & {
  title: TitleWithTags;
};

export type TitleWithTags = Title & {
  tags: TitleTagWithTag[];
};

export type TitleWithRelations = TitleWithTags & {
  listItems: (typeof listItems.$inferSelect & { list: List })[];
};
