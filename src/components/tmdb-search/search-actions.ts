/** Where a Buscar shortcut saves a result. */
export type SearchAddDestination = "watchlist" | "watched";

/** What is running for a result (one at a time). */
export type SearchPendingAction = SearchAddDestination | "open" | "lists" | "tonight";
