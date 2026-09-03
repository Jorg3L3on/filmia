"use client";

import { useState } from "react";
import { removeTitleFromList } from "@/app/actions/lists";
import { CoverflowDeck, type CoverflowTitle } from "@/components/CoverflowDeck";
import { DeckViewToggle } from "@/components/DeckViewToggle";
import { TitleCard } from "@/components/TitleCard";
import type { titleInclude } from "@/lib/queries";
import { parseStoredWatchProviders } from "@/lib/watch-providers";
import type { Prisma } from "@/generated/prisma/client";

type ListItemPayload = Prisma.ListItemGetPayload<{
  include: { title: { include: typeof titleInclude } };
}>;

type ListTitlesViewProps = {
  listId: string;
  items: ListItemPayload[];
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

export const ListTitlesView = ({ listId, items }: ListTitlesViewProps) => {
  const [mode, setMode] = useState<"deck" | "grid">("deck");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DeckViewToggle mode={mode} onChange={setMode} />
      </div>

      {mode === "deck" ? (
        <CoverflowDeck
          titles={items.map(toCoverflowTitle)}
          footer={(title) => {
            const removeAction = removeTitleFromList.bind(null, listId, title.id);
            return (
              <form action={removeAction} className="pt-1">
                <button
                  type="submit"
                  className="text-xs text-[#99aabb] underline-offset-2 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e054]"
                >
                  Quitar de la lista
                </button>
              </form>
            );
          }}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const removeAction = removeTitleFromList.bind(null, listId, item.titleId);
            return (
              <li key={item.titleId} className="space-y-2">
                <TitleCard title={item.title} />
                <form action={removeAction}>
                  <button
                    type="submit"
                    className="w-full text-xs text-[#99aabb] underline-offset-2 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e054]"
                  >
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
