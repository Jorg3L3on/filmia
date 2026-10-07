import { CoverflowDeck, type CoverflowTitle } from "@/components/CoverflowDeck";
import type { Platform, ListItem, Title } from "@/db";
import { currentAvailabilityPlatform } from "@/lib/streaming-platforms";
import { parseStoredWatchProviders } from "@/lib/watch-providers";

type ListItemPayload = ListItem & {
  title: Title;
};

type ListTitlesViewProps = {
  listId: string;
  items: ListItemPayload[];
  platforms?: Platform[];
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
    platform: currentAvailabilityPlatform(watchProviders, item.title.platform, userPlatforms),
    imdbRating: item.title.imdbRating,
    watched: Boolean(item.title.watchedAt),
    review: item.title.review,
    seriesStatus: item.title.kind === "SERIES" ? item.title.seriesStatus : null,
    seriesSeason: item.title.kind === "SERIES" ? item.title.seriesSeason : null,
    flatrateProviders: watchProviders?.flatrate ?? [],
  };
};

export const ListTitlesView = ({ listId, items, platforms }: ListTitlesViewProps) => (
  <CoverflowDeck
    titles={items.map((item) => toCoverflowTitle(item, platforms))}
    listId={listId}
  />
);
