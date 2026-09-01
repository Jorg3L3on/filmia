"use client";

import { useState } from "react";
import { CoverflowDeck, type CoverflowTitle } from "@/components/CoverflowDeck";
import { DeckViewToggle } from "@/components/DeckViewToggle";
import { TitleCard } from "@/components/TitleCard";
import type { titleInclude } from "@/lib/queries";
import type { Prisma } from "@/generated/prisma/client";

type TitlePayload = Prisma.TitleGetPayload<{ include: typeof titleInclude }>;

type TitleDeckViewProps = {
  titles: TitlePayload[];
};

const toCoverflowTitle = (title: TitlePayload): CoverflowTitle => ({
  id: title.id,
  name: title.name,
  kind: title.kind,
  year: title.year,
  rating: title.rating,
  posterPath: title.posterPath,
  platform: title.platform,
  imdbRating: title.imdbRating,
});

export const TitleDeckView = ({ titles }: TitleDeckViewProps) => {
  const [mode, setMode] = useState<"deck" | "grid">("deck");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DeckViewToggle mode={mode} onChange={setMode} />
      </div>

      {mode === "deck" ? (
        <CoverflowDeck titles={titles.map(toCoverflowTitle)} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {titles.map((title) => (
            <li key={title.id}>
              <TitleCard title={title} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
