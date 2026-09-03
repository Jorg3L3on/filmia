import { removeTitleFromList } from "@/app/actions/lists";
import { CoverflowDeck, type CoverflowTitle } from "@/components/CoverflowDeck";
import { DeckViewToggle, type DeckViewMode } from "@/components/DeckViewToggle";
import { PosterTile } from "@/components/PosterTile";
import type { titleInclude } from "@/lib/queries";
import { btnLink } from "@/lib/ui";
import { parseStoredWatchProviders } from "@/lib/watch-providers";
import type { Prisma } from "@/generated/prisma/client";

type ListItemPayload = Prisma.ListItemGetPayload<{
  include: { title: { include: typeof titleInclude } };
}>;

type ListTitlesViewProps = {
  listId: string;
  items: ListItemPayload[];
  mode?: DeckViewMode;
};

const toCoverflowTitle = (item: ListItemPayload): CoverflowTitle => {
  const watchProviders = parseStoredWatchProviders(item.title.watchProvidersMx);

  return {
    id: item.title.id,
    name: item.title.name,
    kind: item.title.kind,
    year: item.title.year,
    rating: item.title.rating,
    posterPath: item.title.posterPath,
    platform: item.title.platform,
    imdbRating: item.title.imdbRating,
    flatrateProviders: watchProviders?.flatrate ?? [],
  };
};

export const ListTitlesView = ({
  listId,
  items,
  mode = "deck",
}: ListTitlesViewProps) => {
  const hrefFor = (nextMode: DeckViewMode) =>
    nextMode === "deck"
      ? `/listas/${listId}`
      : `/listas/${listId}?view=${nextMode}`;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DeckViewToggle mode={mode} hrefFor={hrefFor} />
      </div>

      {mode === "deck" ? (
        <CoverflowDeck
          titles={items.map(toCoverflowTitle)}
          footer={(title) => {
            const removeAction = removeTitleFromList.bind(null, listId, title.id);
            return (
              <form action={removeAction} className="pt-1">
                <button type="submit" className={btnLink}>
                  Quitar de la lista
                </button>
              </form>
            );
          }}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => {
            const removeAction = removeTitleFromList.bind(null, listId, item.titleId);
            return (
              <li key={item.titleId} className="space-y-2">
                <PosterTile
                  href={`/titulos/${item.title.id}`}
                  name={item.title.name}
                  posterPath={item.title.posterPath}
                  year={item.title.year}
                  rating={item.title.rating}
                />
                <form action={removeAction}>
                  <button type="submit" className={`${btnLink} w-full`}>
                    Quitar de la lista
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
