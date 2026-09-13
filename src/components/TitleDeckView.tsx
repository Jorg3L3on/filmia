import { CoverflowDeck, type CoverflowTitle } from "@/components/CoverflowDeck";
import { DeckViewToggle, type DeckViewMode } from "@/components/DeckViewToggle";
import { PosterTile } from "@/components/PosterTile";
import type { Platform } from "@/db";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import type { TitleWithTags } from "@/lib/queries";
import { primaryAvailabilityPlatform } from "@/lib/streaming-platforms";
import { eyebrowClass } from "@/lib/ui";
import { parseStoredWatchProviders } from "@/lib/watch-providers";
import { staggerStyle } from "@/lib/motion";

type TitleDeckViewProps = {
  titles: TitleWithTags[];
  mode?: DeckViewMode;
  modes?: DeckViewMode[];
  hrefFor?: (mode: DeckViewMode) => string;
  heading?: string;
  showToggle?: boolean;
  userPlatforms?: readonly Platform[];
  footer?: "full" | "watched";
};

const toCoverflowTitle = (
  title: TitleWithTags,
  userPlatforms: readonly Platform[] = [],
): CoverflowTitle => {
  const watchProviders = parseStoredWatchProviders(title.watchProvidersMx);
  const availabilityPlatform = primaryAvailabilityPlatform(
    watchProviders?.flatrate,
    title.platform,
    userPlatforms,
  );

  return {
    id: title.id,
    name: title.name,
    kind: title.kind,
    year: title.year,
    rating: title.rating,
    posterPath: title.posterPath,
    platform: availabilityPlatform ?? title.platform,
    imdbRating: title.imdbRating,
    watched: Boolean(title.watchedAt),
    review: title.review,
    seriesStatus: title.kind === "SERIES" ? title.seriesStatus : null,
    seriesSeason: title.kind === "SERIES" ? title.seriesSeason : null,
    flatrateProviders: watchProviders?.flatrate ?? [],
    genres: parseStoredTmdbGenres(title.tmdbGenres),
  };
};

export const TitleDeckView = ({
  titles,
  mode = "deck",
  modes = ["deck", "grid"],
  hrefFor,
  heading,
  showToggle = true,
  userPlatforms = [],
  footer = "full",
}: TitleDeckViewProps) => {
  if (titles.length === 0) {
    return null;
  }

  const showToolbar = Boolean(heading) || (showToggle && hrefFor);
  const cinematic = footer === "watched" && mode === "deck";

  return (
    <section
      className={cinematic ? "diario-que-ver-deck flex min-h-0 flex-1 flex-col gap-2 sm:gap-3" : "space-y-4"}
      aria-label={heading ?? "Mazo"}
    >
      {showToolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {heading ? <h2 className={eyebrowClass}>{heading}</h2> : null}
          {showToggle && hrefFor ? (
            <DeckViewToggle
              mode={mode}
              hrefFor={hrefFor}
              modes={modes}
              className={heading ? undefined : "ml-auto"}
            />
          ) : null}
        </div>
      ) : null}

      {mode === "deck" ? (
        <CoverflowDeck
          titles={titles.map((title) => toCoverflowTitle(title, userPlatforms))}
          footer={footer}
          className={cinematic ? "min-h-0 flex-1" : undefined}
        />
      ) : mode === "calendar" ? null : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          {titles.map((title, index) => (
            <li
              key={title.id}
              className="stagger-in"
              style={staggerStyle(index)}
            >
              <PosterTile
                  titleId={title.id}
                  href={`/titulos/${title.id}`}
                  name={title.name}
                  posterPath={title.posterPath}
                  year={title.year}
                  rating={title.rating}
                  review={title.review}
                  watchedAt={title.watchedAt}
                  tags={title.tags.map((item) => item.tag)}
                  seriesStatus={title.kind === "SERIES" ? title.seriesStatus : null}
                  showMarkSeenEye={footer === "watched"}
                />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
