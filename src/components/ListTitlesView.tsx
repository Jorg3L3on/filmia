import { CoverflowDeck, type CoverflowTitle } from "@/components/CoverflowDeck";
import { DeckViewToggle, type DeckViewMode } from "@/components/DeckViewToggle";
import { ListTitlesGrid } from "@/components/ListTitlesGrid";
import type { Platform, ListItem } from "@/db";
import type { CatalogKindFilter } from "@/lib/catalog-href";
import type { TitleWithTags } from "@/lib/queries";
import type { CatalogSort } from "@/lib/tags";
import { catalogHref } from "@/lib/tags";
import { primaryAvailabilityPlatform } from "@/lib/streaming-platforms";
import { parseStoredWatchProviders } from "@/lib/watch-providers";
import type { SeriesStatusFilter } from "@/lib/series";

type ListItemPayload = ListItem & {
  title: TitleWithTags;
};

type ListTitlesViewProps = {
  listId: string;
  items: ListItemPayload[];
  mode?: DeckViewMode;
  selectedTags?: string[];
  minePlatforms?: boolean;
  seriesStatus?: SeriesStatusFilter;
  kind?: CatalogKindFilter;
  platforms?: Platform[];
  sort?: CatalogSort | null;
};

const toCoverflowTitle = (
  item: ListItemPayload,
  userPlatforms: readonly Platform[] = [],
): CoverflowTitle => {
  const watchProviders = parseStoredWatchProviders(item.title.watchProvidersMx);

  return {
    id: item.title.id,
    name: item.title.name,
    kind: item.title.kind,
    year: item.title.year,
    rating: item.title.rating,
    posterPath: item.title.posterPath,
    platform: primaryAvailabilityPlatform(
      watchProviders?.flatrate,
      item.title.platform,
      userPlatforms,
    ),
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
  kind,
  platforms,
  sort,
}: ListTitlesViewProps) => {
  const hrefFor = (nextMode: DeckViewMode) =>
    catalogHref(`/listas/${listId}`, {
      tags: selectedTags,
      view: nextMode,
      minePlatforms,
      seriesStatus,
      kind,
      platforms,
      sort,
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DeckViewToggle mode={mode} hrefFor={hrefFor} />
      </div>

      {mode === "deck" ? (
        <CoverflowDeck
          titles={items.map((item) => toCoverflowTitle(item, platforms))}
          listId={listId}
        />
      ) : (
        <ListTitlesGrid
          listId={listId}
          items={items}
          showOrder={selectedTags.length === 0 && !minePlatforms && !seriesStatus}
        />
      )}
    </div>
  );
};
