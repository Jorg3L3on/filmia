"use client";

import { useId, type ReactNode } from "react";
import { Sheet, SheetHandle } from "@/components/Sheet";
import type { SearchAddDestination } from "@/components/tmdb-search/search-actions";
import { SearchListPicker } from "@/components/tmdb-search/SearchListPicker";
import type { SearchRowStatus } from "@/components/tmdb-search/SearchResultRow";
import { SearchRowMenu, type SearchMenuTarget } from "@/components/tmdb-search/SearchRowMenu";
import type { SelectableList } from "@/lib/list-selection";
import type { SearchResultFacts } from "@/lib/search-result-facts";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { canOfferTonightPin } from "@/lib/tonight/pin";

type SearchShortcutsProps = {
  menu: SearchMenuTarget | null;
  onCloseMenu: () => void;
  listsFor: TmdbCatalogResult | null;
  onCloseLists: () => void;
  statusOf: (result: TmdbCatalogResult) => { titleId: string | null; status: SearchRowStatus };
  factsFor: (result: TmdbCatalogResult) => SearchResultFacts | null;
  logMode: boolean;
  logDate: string | null;
  pinnedTitleId: string | null;
  hrefFor: (result: TmdbCatalogResult, titleId: string | null) => string;
  lists: SelectableList[];
  listIdsFor: (result: TmdbCatalogResult) => string[];
  listsPending: boolean;
  listsError: string | null;
  onAdd: (result: TmdbCatalogResult, destination: SearchAddDestination) => void;
  onPin: (result: TmdbCatalogResult) => void;
  onPickLists: (result: TmdbCatalogResult) => void;
  onSaveLists: (result: TmdbCatalogResult, initialIds: string[], selectedIds: string[]) => Promise<boolean>;
  onOpenFicha: (href: string) => void;
  /** Lifted copy of the held item; default is the Buscar row. */
  liftFor?: (result: TmdbCatalogResult) => ReactNode;
};

/**
 * What holding a Buscar row offers (FIL-I8, the old preview sheet's actions):
 * the anchored menu, and the lists sheet «Agregar a lista» opens from it.
 */
export const SearchShortcuts = ({
  menu,
  onCloseMenu,
  listsFor,
  onCloseLists,
  statusOf,
  factsFor,
  logMode,
  logDate,
  pinnedTitleId,
  hrefFor,
  lists,
  listIdsFor,
  listsPending,
  listsError,
  onAdd,
  onPin,
  onPickLists,
  onSaveLists,
  onOpenFicha,
  liftFor,
}: SearchShortcutsProps) => {
  const listsTitleId = useId();
  const held = menu ? statusOf(menu.result) : null;
  const run = (action: (result: TmdbCatalogResult) => void) => () => {
    if (!menu) {
      return;
    }
    onCloseMenu();
    action(menu.result);
  };

  return (
    <>
      <SearchRowMenu
        target={menu}
        titleId={held?.titleId ?? null}
        status={held?.status ?? null}
        facts={menu ? factsFor(menu.result) : null}
        logMode={logMode}
        logDate={logDate}
        canPin={canOfferTonightPin({ watched: held?.status === "watched", logMode })}
        pinned={Boolean(held?.titleId && held.titleId === pinnedTitleId)}
        onClose={onCloseMenu}
        onWatchlist={run((result) => onAdd(result, "watchlist"))}
        onWatched={run((result) => onAdd(result, "watched"))}
        onPin={run(onPin)}
        onLists={run(onPickLists)}
        onOpenFicha={run((result) => onOpenFicha(hrefFor(result, statusOf(result).titleId)))}
        lift={menu && liftFor ? liftFor(menu.result) : undefined}
      />

      <Sheet
        open={listsFor !== null}
        onClose={onCloseLists}
        labelledBy={listsTitleId}
        overlayLabel="Cerrar listas"
        layer="top"
        dragDismiss
        portal
      >
        <SheetHandle />
        <div className="px-5 pb-6 pt-2" data-no-sheet-drag>
          <p id={listsTitleId} className="sr-only">
            {listsFor ? `Listas de ${listsFor.name}` : "Listas"}
          </p>
          {listsFor ? (
            <SearchListPicker
              key={`${listsFor.kind}:${listsFor.tmdbId}`}
              lists={lists}
              initialIds={listIdsFor(listsFor)}
              pending={listsPending}
              error={listsError}
              onCancel={onCloseLists}
              onConfirm={(selectedIds) => {
                void onSaveLists(listsFor, listIdsFor(listsFor), selectedIds).then((ok) => {
                  if (ok) {
                    onCloseLists();
                  }
                });
              }}
            />
          ) : null}
        </div>
      </Sheet>
    </>
  );
};
