import type { ListItem } from "@/db";
import type { TitleWithTags } from "@/lib/queries";

export type WatchlistItem = ListItem & {
  title: TitleWithTags;
};
