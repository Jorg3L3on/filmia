"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { PosterImage } from "@/components/PosterImage";
import { SearchShortcuts } from "@/components/tmdb-search/SearchShortcuts";
import type { SearchMenuTarget, SearchMenuVia } from "@/components/tmdb-search/SearchRowMenu";
import type { SearchRowStatus } from "@/components/tmdb-search/SearchResultRow";
import { useTmdbTitleActions } from "@/components/tmdb-search/useTmdbTitleActions";
import type { SelectableList } from "@/lib/list-selection";
import type { UserTmdbEntry } from "@/lib/queries";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { lookupTmdbCatalogEntry } from "@/lib/tmdb-search-catalog";
import { ownedFichaHref, previewFichaHref } from "@/lib/title-preview";
import { posterFrame } from "@/lib/ui";

/** What a second-act tile knows about its title. */
export type ActTwoTitle = Pick<TmdbCatalogResult, "tmdbId" | "kind" | "name" | "originalName" | "year" | "posterPath">;

type ActTwoActionsValue = {
  hrefFor: (title: ActTwoTitle) => string;
  statusOf: (title: ActTwoTitle) => SearchRowStatus;
  openMenu: (title: ActTwoTitle, anchor: DOMRect, via: SearchMenuVia) => void;
};

const ActTwoActionsContext = createContext<ActTwoActionsValue | null>(null);

const fallback: ActTwoActionsValue = {
  hrefFor: (title) => previewFichaHref(title.kind, title.tmdbId),
  statusOf: () => null,
  openMenu: () => {},
};

export const useActTwoActions = () => useContext(ActTwoActionsContext) ?? fallback;

const toResult = (title: ActTwoTitle): TmdbCatalogResult => ({ ...title, backdropPath: null, overview: null });

/**
 * Hoy's second act (FIL-I47-1): a tap on any tile opens Buscar's anchored menu — Quiero ver,
 * Vi esto, Ver esta noche, Agregar a lista, Ver ficha — for films and series, in your Filmia or not.
 */
export const ActTwoActionsProvider = ({
  existing,
  lists,
  memberships,
  pinnedTitleId,
  children,
}: {
  existing: UserTmdbEntry[];
  lists: SelectableList[];
  memberships: Record<string, string[]>;
  pinnedTitleId: string | null;
  children: ReactNode;
}) => {
  const router = useRouter();
  const actions = useTmdbTitleActions({ existing, lists, memberships, pinnedTitleId });
  const [menu, setMenu] = useState<SearchMenuTarget | null>(null);
  const [listsFor, setListsFor] = useState<TmdbCatalogResult | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  const resultHref = (result: TmdbCatalogResult, titleId: string | null) =>
    titleId && !titleId.startsWith("pending:") ? ownedFichaHref(titleId) : previewFichaHref(result.kind, result.tmdbId);
  const resultStatus = (result: TmdbCatalogResult) => {
    const local = lookupTmdbCatalogEntry(actions.catalog, result.tmdbId, result.kind);
    const status: SearchRowStatus = local?.watched ? "watched" : local?.inWatchlist ? "watchlist" : null;
    return { titleId: local?.titleId ?? null, status };
  };

  const value: ActTwoActionsValue = {
    hrefFor: (title) => {
      const result = toResult(title);
      return resultHref(result, resultStatus(result).titleId);
    },
    statusOf: (title) => resultStatus(toResult(title)).status,
    openMenu: (title, anchor, via) => setMenu({ result: toResult(title), anchor, via }),
  };

  return (
    <ActTwoActionsContext.Provider value={value}>
      {children}
      <SearchShortcuts
        menu={menu}
        onCloseMenu={closeMenu}
        listsFor={listsFor}
        onCloseLists={() => setListsFor(null)}
        statusOf={resultStatus}
        factsFor={() => null}
        logMode={false}
        logDate={null}
        pinnedTitleId={actions.pinnedTitleId}
        hrefFor={resultHref}
        lists={lists}
        listIdsFor={actions.listIdsFor}
        listsPending={actions.isAdding}
        listsError={actions.listsError}
        onAdd={actions.handleAdd}
        onPin={actions.handlePinTonight}
        onPickLists={setListsFor}
        onSaveLists={actions.handleSaveLists}
        onOpenFicha={(href) => router.push(href)}
        liftFor={(result) => (
          <div className={`${posterFrame} h-full shadow-[0_24px_60px_rgb(0_0_0/0.7)]`}>
            <PosterImage name={result.name} posterPath={result.posterPath} ratio="fill" sizes="160px" />
          </div>
        )}
      />
    </ActTwoActionsContext.Provider>
  );
};
