"use client";

import { useState } from "react";
import { CoverflowDeck, type CoverflowTitle } from "@/components/CoverflowDeck";
import { DeckViewToggle, type DeckViewMode } from "@/components/DeckViewToggle";
import { DiaryCalendar } from "@/components/DiaryCalendar";
import { PosterTile } from "@/components/PosterTile";
import type { titleInclude } from "@/lib/queries";
import { parseStoredWatchProviders } from "@/lib/watch-providers";
import type { Prisma } from "@/generated/prisma/client";

type TitlePayload = Prisma.TitleGetPayload<{ include: typeof titleInclude }>;

type TitleDeckViewProps = {
  titles: TitlePayload[];
  defaultMode?: DeckViewMode;
  modes?: DeckViewMode[];
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
    flatrateProviders: watchProviders?.flatrate ?? [],
  };
};

export const TitleDeckView = ({
  titles,
  defaultMode = "deck",
  modes = ["deck", "grid"],
}: TitleDeckViewProps) => {
  const [mode, setMode] = useState<DeckViewMode>(defaultMode);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DeckViewToggle mode={mode} onChange={setMode} modes={modes} />
      </div>

      {mode === "calendar" ? (
        <DiaryCalendar titles={titles} />
      ) : mode === "deck" ? (
        <CoverflowDeck titles={titles.map(toCoverflowTitle)} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {titles.map((title) => (
            <li key={title.id}>
              <PosterTile
                href={`/titulos/${title.id}`}
                name={title.name}
                posterPath={title.posterPath}
                year={title.year}
                rating={title.rating}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
