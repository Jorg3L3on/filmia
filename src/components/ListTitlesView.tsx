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
  /** Shared lists (FIL-I18): names of whoever added films, so each poster says who. */
  addedByNames?: Map<string, string | null>;
};

export const ListTitlesView = ({
  listId,
  items,
  platforms,
  initialCardId = null,
  addedByNames,
}: ListTitlesViewProps) => (
  <CoverflowDeck
    titles={items.map((item) => ({
      ...toCoverflowTitle(item.title, platforms),
      // A film the viewer never saved has no entry of theirs (see `titleWithoutEntry`).
      ...(item.title.userId === "" ? { noEntry: true } : {}),
      ...(addedByNames
        ? {
            addedBy: {
              id: item.addedByUserId,
              name: item.addedByUserId ? (addedByNames.get(item.addedByUserId) ?? null) : null,
              addedAt: item.addedAt.toISOString(),
              note: item.queueNote,
            },
          }
        : {}),
    }))}
    listId={listId}
    footer="list"
    syncCardParam
    initialCardId={initialCardId}
  />
);
