import type { ListItem, Title } from "@/db";

export type WatchlistItem = ListItem & {
  title: Title;
};
