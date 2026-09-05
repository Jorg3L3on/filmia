import { removeTitleFromList } from "@/app/actions/lists";
import { CoverflowDeck, type CoverflowTitle } from "@/components/CoverflowDeck";
import { DeckViewToggle, type DeckViewMode } from "@/components/DeckViewToggle";
import { ListItemOrderControls } from "@/components/ListItemOrderControls";
import { MarkWatchedForm } from "@/components/MarkWatchedForm";
import { PosterTile } from "@/components/PosterTile";
import type { TitleWithRelations } from "@/lib/queries";
import { catalogHref } from "@/lib/tags";
import { btnLink } from "@/lib/ui";
import { parseStoredWatchProviders } from "@/lib/watch-providers";
import type { SeriesStatusFilter } from "@/lib/series";
import type { ListItem } from "@/db";

type ListItemPayload = ListItem & {
  title: TitleWithRelations;
};

type ListTitlesViewProps = {
  listId: string;
  items: ListItemPayload[];
  mode?: DeckViewMode;
  selectedTags?: string[];
  minePlatforms?: boolean;
  seriesStatus?: SeriesStatusFilter;
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
    watched: Boolean(item.title.watchedAt),
    review: item.title.review,
    seriesStatus: item.title.kind === "SERIES" ? item.title.seriesStatus : null,
    seriesSeason: item.title.kind === "SERIES" ? item.title.seriesSeason : null,
    flatrateProviders: watchProviders?.flatrate ?? [],
  };
};

export const ListTitlesView = ({
  listId,
  items,
  mode = "deck",
  selectedTags = [],
  minePlatforms = false,
  seriesStatus,
}: ListTitlesViewProps) => {
  const hrefFor = (nextMode: DeckViewMode) =>
    catalogHref(`/listas/${listId}`, {
      tags: selectedTags,
      view: nextMode,
      minePlatforms,
      seriesStatus,
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DeckViewToggle mode={mode} hrefFor={hrefFor} />
      </div>

      {mode === "deck" ? (
        <CoverflowDeck
          titles={items.map(toCoverflowTitle)}
          listId={listId}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item, index) => {
            const removeAction = removeTitleFromList.bind(null, listId, item.titleId);
            return (
              <li key={item.titleId} className="space-y-2">
                <PosterTile
                  href={`/titulos/${item.title.id}`}
                  name={item.title.name}
                  posterPath={item.title.posterPath}
                  year={item.title.year}
                  rating={item.title.rating}
                  watchedAt={item.title.watchedAt}
                  tags={item.title.tags.map((entry) => entry.tag)}
                  seriesStatus={
                    item.title.kind === "SERIES" ? item.title.seriesStatus : null
                  }
                />
                {selectedTags.length === 0 && !minePlatforms && !seriesStatus ? (
                  <ListItemOrderControls
                    listId={listId}
                    titleId={item.titleId}
                    canMoveUp={index > 0}
                    canMoveDown={index < items.length - 1}
                  />
                ) : null}
                {!item.title.watchedAt ? (
                  <MarkWatchedForm
                    titleId={item.title.id}
                    variant="queue"
                    rating={item.title.rating}
                    review={item.title.review}
                    collapsed
                  />
                ) : null}
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
