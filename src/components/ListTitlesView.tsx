import { CoverflowDeck } from "@/components/CoverflowDeck";
import type { Platform, ListItem, Title } from "@/db";
import { toCoverflowTitle } from "@/lib/coverflow-title";

type ListItemPayload = ListItem & {
  title: Title;
};

type ListTitlesViewProps = {
  /** Sin `listId` el mazo no ofrece «Quitar de la lista» (listas automáticas). */
  listId?: string;
  items: ListItemPayload[];
  platforms?: Platform[];
  /** `?carta=` from the page: the deck reopens on the card the user left. */
  initialCardId?: string | null;
};

export const ListTitlesView = ({ listId, items, platforms, initialCardId = null }: ListTitlesViewProps) => (
  <CoverflowDeck
    titles={items.map((item) => toCoverflowTitle(item.title, platforms))}
    listId={listId}
    footer="list"
    syncCardParam
    initialCardId={initialCardId}
  />
);
