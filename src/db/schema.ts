import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
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
export const listKindEnum = pgEnum("ListKind", ["COLLECTION", "WATCHLIST", "YEAR_TOP"]);
/** A member's role on a shared list. The owner is `List.userId`, never a member row. */
export const listRoleEnum = pgEnum("ListRole", ["EDITOR", "VIEWER"]);
export const listInviteKindEnum = pgEnum("ListInviteKind", ["PERSONAL", "GROUP"]);
export const listJoinRequestStatusEnum = pgEnum("ListJoinRequestStatus", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

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

export type ListRole = (typeof listRoleEnum.enumValues)[number];
export const ListRole = enumObject(listRoleEnum.enumValues);

export type ListInviteKind = (typeof listInviteKindEnum.enumValues)[number];
export const ListInviteKind = enumObject(listInviteKindEnum.enumValues);

export type ListJoinRequestStatus = (typeof listJoinRequestStatusEnum.enumValues)[number];
export const ListJoinRequestStatus = enumObject(listJoinRequestStatusEnum.enumValues);

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
    /** Signed into every session token; bumping it (password change) revokes older sessions. */
    sessionVersion: integer("sessionVersion").notNull().default(0),
    /** Rutas (FIL-I26): the first ruta was offered (made, or declined in the Bienvenida); Hoy never offers it again. */
    rutasOfferedAt: timestamp("rutasOfferedAt", { precision: 3, mode: "date" }),
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
    /** When a flatrate MX offer appeared after a look without one — drives «Acaba de llegar». */
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
    /** YEAR_TOP only: the release year the top 10 is about (slug `top-{year}`). */
    year: integer("year"),
    /** Shared lists: a link only creates a join request the owner approves. */
    requireApproval: boolean("requireApproval").notNull().default(true),
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

/**
 * A film in a list. Keyed by the shared `Catalog` row (FIL-I18), not by anyone's
 * `Title`: on a shared list an editor adds films the owner never saved, and
 * deleting your own entry no longer removes it from other people's lists.
 */
export const listItems = pgTable(
  "ListItem",
  {
    listId: text("listId")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    catalogId: text("catalogId")
      .notNull()
      .references(() => catalog.id, { onDelete: "cascade" }),
    /** Who put it there; null once that account is gone («usuario eliminado»). */
    addedByUserId: text("addedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    position: integer("position").notNull().default(0),
    queueNote: text("queueNote"),
    addedAt: timestamp("addedAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
    /** «Vamos con esta» (FIL-I19-3): the film the group picked; one per list, null otherwise. */
    chosenAt: timestamp("chosenAt", { precision: 3, mode: "date" }),
    chosenByUserId: text("chosenByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    primaryKey({ columns: [table.listId, table.catalogId] }),
    index("ListItem_listId_position_idx").on(table.listId, table.position),
    index("ListItem_catalogId_idx").on(table.catalogId),
  ],
);

/** People a list is shared with (FIL-I18). The owner is `List.userId` and has no row here. */
export const listMembers = pgTable(
  "ListMember",
  {
    listId: text("listId")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: listRoleEnum("role").notNull(),
    joinedAt: timestamp("joinedAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.listId, table.userId] }),
    index("ListMember_userId_idx").on(table.userId),
  ],
);

/**
 * A share link. Only the sha256 of the token is stored. PERSONAL: one use,
 * expires in 7 days. GROUP: up to `maxUses`, can be switched off and on.
 */
export const listInvites = pgTable(
  "ListInvite",
  {
    id: text("id").primaryKey(),
    listId: text("listId")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    kind: listInviteKindEnum("kind").notNull(),
    role: listRoleEnum("role").notNull(),
    tokenHash: text("tokenHash").notNull(),
    createdByUserId: text("createdByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expiresAt", { precision: 3, mode: "date" }),
    maxUses: integer("maxUses").notNull(),
    usedCount: integer("usedCount").notNull().default(0),
    disabledAt: timestamp("disabledAt", { precision: 3, mode: "date" }),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ListInvite_tokenHash_key").on(table.tokenHash),
    index("ListInvite_listId_idx").on(table.listId),
  ],
);

/** «Ana quiere unirse»: what a link creates while the list requires approval. */
export const listJoinRequests = pgTable(
  "ListJoinRequest",
  {
    id: text("id").primaryKey(),
    listId: text("listId")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteId: text("inviteId").references(() => listInvites.id, { onDelete: "set null" }),
    role: listRoleEnum("role").notNull(),
    status: listJoinRequestStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decidedAt", { precision: 3, mode: "date" }),
    decidedByUserId: text("decidedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    /** When the requester saw the outcome (the neutral «no se pudo» notice). */
    seenAt: timestamp("seenAt", { precision: 3, mode: "date" }),
  },
  (table) => [
    uniqueIndex("ListJoinRequest_pending_key")
      .on(table.listId, table.userId)
      .where(sql`"status" = 'PENDING'`),
    index("ListJoinRequest_userId_idx").on(table.userId),
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

/**
 * Feedback for Esta noche: impressions, skips, «Ahora no», opens, Más/Menos así.
 * An event is about a film, not about a user's entry: `catalogId` is the identity
 * (recommendations have no `Title` yet), `titleId` is kept for events on titles the
 * user owns. Both are nullable so builds from before 0011 keep inserting.
 */
export const pickEvents = pgTable(
  "PickEvent",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: text("titleId").references(() => titles.id, { onDelete: "cascade" }),
    catalogId: text("catalogId").references(() => catalog.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    lens: text("lens"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("PickEvent_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("PickEvent_userId_titleId_idx").on(table.userId, table.titleId),
    index("PickEvent_userId_catalogId_idx").on(table.userId, table.catalogId),
  ],
);

/**
 * The user's pool of recommended films (Hoy · «Recomendada»): candidates from TMDB that are
 * not in their library, ranked by the Esta noche engine and computed by the nightly cron.
 * Lenses pick from it at read time, so reading Hoy never calls TMDB. A cache like
 * `TonightPick`: safe to delete, rebuilt on the next run.
 */
export const tonightRecos = pgTable(
  "TonightReco",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    catalogId: text("catalogId")
      .notNull()
      .references(() => catalog.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull().default(0),
    score: real("score").notNull().default(0),
    components: jsonb("components").notNull().default({}),
    reasons: jsonb("reasons").notNull().default([]),
    /** `recommendations` (TMDB item-to-item from a seed) or `discover` (by genre on your platforms). */
    sourceKind: text("sourceKind").notNull(),
    /** The library film that led here, when the source was a seed. */
    seedCatalogId: text("seedCatalogId"),
    seedName: text("seedName"),
    computedAt: timestamp("computedAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.catalogId] }),
    index("TonightReco_userId_rank_idx").on(table.userId, table.rank),
  ],
);

/**
 * Fixed-window counters for login, signup and password change (FIL-I10-2). `key` is
 * `<rule>:<subject>` with the subject hashed; expired rows are swept on write.
 */
export const rateLimits = pgTable("RateLimit", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("resetAt", { precision: 3, mode: "date" }).notNull(),
});

/**
 * One Web Push endpoint per browser/device that turned on «Avisos» in Perfil. Having a row is
 * the opt-in; the browser's `PushSubscription.toJSON()` is stored as is. Rows the push service
 * answers 404/410 for are deleted on the next send.
 */
export const pushSubscriptions = pgTable(
  "PushSubscription",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
    lastSuccessAt: timestamp("lastSuccessAt", { precision: 3, mode: "date" }),
  },
  (table) => [
    uniqueIndex("PushSubscription_endpoint_key").on(table.endpoint),
    index("PushSubscription_userId_idx").on(table.userId),
  ],
);

/**
 * «Llegó a tu plataforma» ledger: one row per arrival a user was told about. Keyed by the
 * catalog's `availableSince` stamp, so the same arrival is never sent twice and a title that
 * leaves and comes back (new stamp) counts again.
 */
export const platformAlerts = pgTable(
  "PlatformAlert",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    catalogId: text("catalogId")
      .notNull()
      .references(() => catalog.id, { onDelete: "cascade" }),
    availableSince: timestamp("availableSince", { precision: 3, mode: "date" }).notNull(),
    platform: platformEnum("platform").notNull(),
    sentAt: timestamp("sentAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.catalogId, table.availableSince] }),
  ],
);

/**
 * Cine (FIL-I17): films in MX theaters or announced for them, materialized by the daily cron
 * from TMDB (and the IMCINE file for Mexican cinema). Rows are never deleted: a film that stops
 * showing up for 3 days turns `gone`, which is what «Ya en casa» reads.
 */
export const cinemaReleases = pgTable(
  "CinemaRelease",
  {
    catalogId: text("catalogId")
      .primaryKey()
      .references(() => catalog.id, { onDelete: "cascade" }),
    /** Commercial MX release (TMDB type 3, or IMCINE). Calendar day, no time. */
    mxReleaseDate: date("mxReleaseDate", { mode: "string" }).notNull(),
    /** `now` | `upcoming` | `gone` (see `CinemaReleaseStatus`). */
    status: text("status").notNull(),
    popularity: real("popularity").notNull().default(0),
    firstSeenAt: timestamp("firstSeenAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("lastSeenAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
    /** `tmdb` | `imcine`; an IMCINE date wins over TMDB's. */
    source: text("source").notNull().default("tmdb"),
  },
  (table) => [
    index("CinemaRelease_status_mxReleaseDate_idx").on(table.status, table.mxReleaseDate),
  ],
);

/** «Lo mejor del año · según IMDb»: ten films per release year, recomputed weekly by the cron. */
export const yearTops = pgTable(
  "YearTop",
  {
    year: integer("year").notNull(),
    rank: integer("rank").notNull(),
    catalogId: text("catalogId")
      .notNull()
      .references(() => catalog.id, { onDelete: "cascade" }),
    imdbRating: real("imdbRating").notNull(),
    imdbVotes: integer("imdbVotes").notNull(),
    computedAt: timestamp("computedAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.year, table.rank] })],
);

/**
 * «Llega a cines» ledger (FIL-I17-6): one row per Quiero ver film a user was told premieres in MX.
 * Keyed by the release date, so a date that moves (IMCINE) can be announced again.
 */
export const cinemaAlerts = pgTable(
  "CinemaAlert",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    catalogId: text("catalogId")
      .notNull()
      .references(() => catalog.id, { onDelete: "cascade" }),
    mxReleaseDate: date("mxReleaseDate", { mode: "string" }).notNull(),
    sentAt: timestamp("sentAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.catalogId, table.mxReleaseDate] })],
);

/**
 * MCP connector (FIL-I20). An OAuth client: registered by DCR (`id` is a random UUID) or
 * resolved from a Client ID Metadata Document (`id` is the https URL, `isCimd`). Clients are
 * shared; what a person allowed lives on `McpOAuthGrant`.
 */
export const mcpOAuthClients = pgTable("McpOAuthClient", {
  id: text("id").primaryKey(),
  clientName: text("clientName").notNull(),
  redirectUris: text("redirectUris").array().notNull(),
  grantTypes: text("grantTypes").array().notNull(),
  responseTypes: text("responseTypes").array().notNull(),
  /** `none` (PKCE only) or `client_secret_post`; `private_key_jwt` CIMDs are stored as `none`. */
  tokenEndpointAuthMethod: text("tokenEndpointAuthMethod").notNull(),
  clientUri: text("clientUri"),
  logoUri: text("logoUri"),
  clientSecretHash: text("clientSecretHash"),
  isCimd: boolean("isCimd").notNull().default(false),
  /** CIMD only: when the document was last fetched; re-fetched after 24 h. */
  fetchedAt: timestamp("fetchedAt", { precision: 3, mode: "date" }),
  /** First successful code exchange; DCR clients that never get one are swept after 7 days. */
  firstTokenAt: timestamp("firstTokenAt", { precision: 3, mode: "date" }),
  createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().defaultNow(),
});

/** Single-use authorization code (10 min). `usedAt` is claimed with a conditional update. */
export const mcpOAuthAuthorizationCodes = pgTable(
  "McpOAuthAuthorizationCode",
  {
    id: text("id").primaryKey(),
    codeHash: text("codeHash").notNull(),
    clientId: text("clientId")
      .notNull()
      .references(() => mcpOAuthClients.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    redirectUri: text("redirectUri").notNull(),
    codeChallenge: text("codeChallenge").notNull(),
    resource: text("resource").notNull(),
    allowWrite: boolean("allowWrite").notNull().default(false),
    expiresAt: timestamp("expiresAt", { precision: 3, mode: "date" }).notNull(),
    usedAt: timestamp("usedAt", { precision: 3, mode: "date" }),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("McpOAuthAuthorizationCode_codeHash_key").on(table.codeHash)],
);

/**
 * One connection a person approved: a client acting for one user, for one resource. Access
 * tokens last 24 h, refresh tokens 365 d from each rotation; the refresh token it replaced is
 * kept so a replay revokes the grant.
 */
export const mcpOAuthGrants = pgTable(
  "McpOAuthGrant",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("clientId")
      .notNull()
      .references(() => mcpOAuthClients.id, { onDelete: "cascade" }),
    authorizationCodeId: text("authorizationCodeId"),
    tokenPrefix: text("tokenPrefix").notNull(),
    tokenHash: text("tokenHash").notNull(),
    refreshTokenHash: text("refreshTokenHash").notNull(),
    previousRefreshTokenHash: text("previousRefreshTokenHash"),
    allowWrite: boolean("allowWrite").notNull().default(false),
    resource: text("resource").notNull(),
    expiresAt: timestamp("expiresAt", { precision: 3, mode: "date" }).notNull(),
    refreshExpiresAt: timestamp("refreshExpiresAt", { precision: 3, mode: "date" }).notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().defaultNow(),
    lastUsedAt: timestamp("lastUsedAt", { precision: 3, mode: "date" }),
    revokedAt: timestamp("revokedAt", { precision: 3, mode: "date" }),
    revokedReason: text("revokedReason"),
  },
  (table) => [
    uniqueIndex("McpOAuthGrant_tokenPrefix_key").on(table.tokenPrefix),
    uniqueIndex("McpOAuthGrant_refreshTokenHash_key").on(table.refreshTokenHash),
    index("McpOAuthGrant_previousRefreshTokenHash_idx").on(table.previousRefreshTokenHash),
    index("McpOAuthGrant_authorizationCodeId_idx").on(table.authorizationCodeId),
    index("McpOAuthGrant_userId_idx").on(table.userId),
  ],
);

/** Personal token for clients without OAuth (Cursor). Only the prefix and a sha256 are kept. */
export const mcpPersonalTokens = pgTable(
  "McpPersonalToken",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenPrefix: text("tokenPrefix").notNull(),
    tokenHash: text("tokenHash").notNull(),
    allowWrite: boolean("allowWrite").notNull().default(false),
    expiresAt: timestamp("expiresAt", { precision: 3, mode: "date" }).notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().defaultNow(),
    lastUsedAt: timestamp("lastUsedAt", { precision: 3, mode: "date" }),
    revokedAt: timestamp("revokedAt", { precision: 3, mode: "date" }),
  },
  (table) => [
    uniqueIndex("McpPersonalToken_tokenPrefix_key").on(table.tokenPrefix),
    index("McpPersonalToken_userId_idx").on(table.userId),
  ],
);

/**
 * One row per POST to the token endpoint, with no secrets: which fields came and how it
 * ended. Rate-limited requests, OPTIONS and GET are not written. Kept 30 days.
 */
export const mcpOAuthTokenAttempts = pgTable(
  "McpOAuthTokenAttempt",
  {
    id: text("id").primaryKey(),
    grantType: text("grantType"),
    clientIdKind: text("clientIdKind").notNull(),
    hasCode: boolean("hasCode").notNull(),
    hasVerifier: boolean("hasVerifier").notNull(),
    hasAssertion: boolean("hasAssertion").notNull(),
    resourceKind: text("resourceKind").notNull(),
    error: text("error").notNull(),
    invalidGrantReason: text("invalidGrantReason"),
    httpStatus: integer("httpStatus").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("McpOAuthTokenAttempt_createdAt_idx").on(table.createdAt)],
);

/**
 * MCP activity (FIL-I20-6): one row per tools/call, written after the response. What Perfil →
 * Conexiones shows per connection. No arguments or results are stored. Kept 90 days.
 */
export const mcpToolCalls = pgTable(
  "McpToolCall",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** `oauth` (connectionId = McpOAuthGrant.id) or `personal_token` (McpPersonalToken.id). */
    source: text("source").notNull(),
    connectionId: text("connectionId").notNull(),
    tool: text("tool").notNull(),
    ok: boolean("ok").notNull(),
    errorCode: text("errorCode"),
    durationMs: integer("durationMs").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("McpToolCall_connectionId_createdAt_idx").on(table.connectionId, table.createdAt),
    index("McpToolCall_userId_createdAt_idx").on(table.userId, table.createdAt),
  ],
);

/**
 * Write tools' idempotency (FIL-I20-5): the first answer to `(userId, key)` is replayed for 24 h,
 * so a client that retries does not add twice. `argsHash` catches a key reused for other args.
 */
export const mcpIdempotencyKeys = pgTable(
  "McpIdempotencyKey",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    tool: text("tool").notNull(),
    argsHash: text("argsHash").notNull(),
    response: jsonb("response"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.key] }),
    index("McpIdempotencyKey_createdAt_idx").on(table.createdAt),
  ],
);

/**
 * Rutas (FIL-I26): 3–8 films in an order, one line of why per step. Built from a TMDB
 * collection, a person's filmography, a title's recommendations or by hand. At most two are
 * `activa` (Hoy shows them); the rest wait (`espera`) with no reminders. A step is done when the
 * person's `Title` for its film is watched: «lo visto cuenta», whatever screen marked it.
 */
export const rutas = pgTable(
  "Ruta",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** `coleccion` | `persona` | `titulo` | `curada` | `temporada` (see `RutaKind`). */
    kind: text("kind").notNull(),
    /** «El señor de los anillos, la trilogía». */
    title: text("title").notNull(),
    /** What a second lens in Hoy is called («Lord & Miller»). */
    shortTitle: text("shortTitle").notNull(),
    /** One line under the title: why this ruta is for you. */
    reason: text("reason"),
    /** What it was built from (`coleccion:119`, `persona:108:director`): one ruta per source. */
    sourceKey: text("sourceKey").notNull(),
    /** The film of the library that led here. */
    seedCatalogId: text("seedCatalogId").references(() => catalog.id, { onDelete: "set null" }),
    /** `activa` | `espera` | `cerrada`. */
    status: text("status").notNull(),
    startedAt: timestamp("startedAt", { precision: 3, mode: "date" }).notNull().defaultNow(),
    closedAt: timestamp("closedAt", { precision: 3, mode: "date" }),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("Ruta_userId_sourceKey_key").on(table.userId, table.sourceKey),
    index("Ruta_userId_status_idx").on(table.userId, table.status),
  ],
);

/** One film of a ruta. `revealedAt` / `doneAt` are stamped the first time they hold (telemetry, «en 11 días»). */
export const rutaPasos = pgTable(
  "RutaPaso",
  {
    rutaId: text("rutaId")
      .notNull()
      .references(() => rutas.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    catalogId: text("catalogId")
      .notNull()
      .references(() => catalog.id, { onDelete: "cascade" }),
    /** Why this step, once it is face up. */
    why: text("why").notNull(),
    /** The one line a face-down step shows. */
    hint: text("hint").notNull(),
    revealedAt: timestamp("revealedAt", { precision: 3, mode: "date" }),
    doneAt: timestamp("doneAt", { precision: 3, mode: "date" }),
  },
  (table) => [
    primaryKey({ columns: [table.rutaId, table.position] }),
    index("RutaPaso_catalogId_idx").on(table.catalogId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  titles: many(titles),
  lists: many(lists),
}));

export const catalogRelations = relations(catalog, ({ many, one }) => ({
  titles: many(titles),
  cinemaRelease: one(cinemaReleases, {
    fields: [catalog.id],
    references: [cinemaReleases.catalogId],
  }),
}));

export const cinemaReleasesRelations = relations(cinemaReleases, ({ one }) => ({
  catalog: one(catalog, { fields: [cinemaReleases.catalogId], references: [catalog.id] }),
}));

export const yearTopsRelations = relations(yearTops, ({ one }) => ({
  catalog: one(catalog, { fields: [yearTops.catalogId], references: [catalog.id] }),
}));

export const titlesRelations = relations(titles, ({ one }) => ({
  user: one(users, { fields: [titles.userId], references: [users.id] }),
  catalog: one(catalog, { fields: [titles.catalogId], references: [catalog.id] }),
}));

export const listsRelations = relations(lists, ({ one, many }) => ({
  user: one(users, { fields: [lists.userId], references: [users.id] }),
  items: many(listItems),
  members: many(listMembers),
}));

export const listItemsRelations = relations(listItems, ({ one }) => ({
  list: one(lists, { fields: [listItems.listId], references: [lists.id] }),
  catalog: one(catalog, { fields: [listItems.catalogId], references: [catalog.id] }),
  addedBy: one(users, { fields: [listItems.addedByUserId], references: [users.id] }),
}));

export const listMembersRelations = relations(listMembers, ({ one }) => ({
  list: one(lists, { fields: [listMembers.listId], references: [lists.id] }),
  user: one(users, { fields: [listMembers.userId], references: [users.id] }),
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
export type ListMemberRow = typeof listMembers.$inferSelect;
export type ListInviteRow = typeof listInvites.$inferSelect;
export type ListJoinRequestRow = typeof listJoinRequests.$inferSelect;
export type TonightPickRow = typeof tonightPicks.$inferSelect;
export type PickEventRow = typeof pickEvents.$inferSelect;
export type TonightRecoRow = typeof tonightRecos.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type PlatformAlertRow = typeof platformAlerts.$inferSelect;
export type CinemaReleaseRow = typeof cinemaReleases.$inferSelect;
export type YearTopRow = typeof yearTops.$inferSelect;
export type CinemaAlertRow = typeof cinemaAlerts.$inferSelect;
export type RutaRow = typeof rutas.$inferSelect;
export type RutaPasoRow = typeof rutaPasos.$inferSelect;

export type ListItemWithTitleRelations = typeof listItems.$inferSelect & {
  title: Title;
};

export type TitleWithRelations = Title & {
  listItems: (typeof listItems.$inferSelect & { list: List })[];
};
export type McpOAuthClientRow = typeof mcpOAuthClients.$inferSelect;
export type McpOAuthAuthorizationCodeRow = typeof mcpOAuthAuthorizationCodes.$inferSelect;
export type McpOAuthGrantRow = typeof mcpOAuthGrants.$inferSelect;
export type McpPersonalTokenRow = typeof mcpPersonalTokens.$inferSelect;
export type McpToolCallRow = typeof mcpToolCalls.$inferSelect;
