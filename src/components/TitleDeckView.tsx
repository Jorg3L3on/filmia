import type { CSSProperties } from "react";
import { CoverflowDeck, type CoverflowTitle } from "@/components/CoverflowDeck";
import { DeckViewToggle, type DeckViewMode } from "@/components/DeckViewToggle";
import { PosterTile } from "@/components/PosterTile";
import type { titleInclude } from "@/lib/queries";
import { eyebrowClass } from "@/lib/ui";
import { parseStoredWatchProviders } from "@/lib/watch-providers";
import type { Prisma } from "@/generated/prisma/browser";

type TitlePayload = Prisma.TitleGetPayload<{ include: typeof titleInclude }>;

type TitleDeckViewProps = {
  titles: TitlePayload[];
  mode?: DeckViewMode;
  modes?: DeckViewMode[];
  hrefFor?: (mode: DeckViewMode) => string;
  heading?: string;
  showToggle?: boolean;
};

const toCoverflowTitle = (title: TitlePayload): CoverflowTitle => {
  const watchProviders = parseStoredWatchProviders(title.watchProvidersMx);

  return {
    id: title.id,
    name: title.name,
    kind: title.kind,
    year: title.year,
    rating: title.rating,
    posterPath: title.posterPath,
    platform: title.platform,
    imdbRating: title.imdbRating,
    watched: Boolean(title.watchedAt),
    review: title.review,
    seriesStatus: title.kind === "SERIES" ? title.seriesStatus : null,
    seriesSeason: title.kind === "SERIES" ? title.seriesSeason : null,
    flatrateProviders: watchProviders?.flatrate ?? [],
  };
};

export const TitleDeckView = ({
  titles,
  mode = "deck",
  modes = ["deck", "grid"],
  hrefFor,
  heading,
  showToggle = true,
}: TitleDeckViewProps) => {
  if (titles.length === 0) {
    return null;
  }

  const showToolbar = Boolean(heading) || (showToggle && hrefFor);

  return (
    <section className="space-y-4" aria-label={heading}>
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
        <CoverflowDeck titles={titles.map(toCoverflowTitle)} />
      ) : mode === "calendar" ? null : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {titles.map((title, index) => (
            <li
              key={title.id}
              className="stagger-in"
              style={{ "--stagger": index } as CSSProperties}
            >
              <PosterTile
                  titleId={title.id}
                  href={`/titulos/${title.id}`}
                  name={title.name}
                  posterPath={title.posterPath}
                  year={title.year}
                  rating={title.rating}
                  watchedAt={title.watchedAt}
                  tags={title.tags.map((item) => item.tag)}
                  seriesStatus={title.kind === "SERIES" ? title.seriesStatus : null}
                />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
