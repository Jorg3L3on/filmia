"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { PosterImage } from "@/components/PosterImage";
import { SearchShortcuts } from "@/components/tmdb-search/SearchShortcuts";
import type { SearchMenuTarget } from "@/components/tmdb-search/SearchRowMenu";
import type { SearchRowStatus } from "@/components/tmdb-search/SearchResultRow";
import { useTmdbTitleActions } from "@/components/tmdb-search/useTmdbTitleActions";
import type { CineFilm } from "@/lib/cine";
import type { SelectableList } from "@/lib/list-selection";
import type { UserTmdbEntry } from "@/lib/queries";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { lookupTmdbCatalogEntry } from "@/lib/tmdb-search-catalog";
import { ownedFichaHref, previewFichaHref } from "@/lib/title-preview";
import { posterFrame } from "@/lib/ui";

type CineActionsValue = {
  hrefFor: (film: CineFilm) => string;
  statusOf: (film: CineFilm) => SearchRowStatus;
  openMenu: (film: CineFilm, anchor: DOMRect) => void;
};

const CineActionsContext = createContext<CineActionsValue | null>(null);

/** Posters outside a provider (tests, previews) still link to the TMDB preview. */
const fallback: CineActionsValue = {
  hrefFor: (film) => previewFichaHref("MOVIE", film.tmdbId),
  statusOf: () => null,
  openMenu: () => {},
};

export const useCineActions = () => useContext(CineActionsContext) ?? fallback;

const toResult = (film: CineFilm): TmdbCatalogResult => ({
  tmdbId: film.tmdbId,
  kind: "MOVIE",
  name: film.name,
  originalName: film.originalName,
  year: film.year,
  posterPath: film.posterPath,
  backdropPath: null,
  overview: null,
});

/**
 * Cine's posters behave like Buscar's results (FIL-I17-4): a tap opens the ficha — yours when
 * the film is in your Filmia, the TMDB preview otherwise — and holding one opens the same
 * anchored menu (Quiero ver, Vi esto, Ver esta noche, Agregar a lista, Ver ficha).
 */
export const CineActionsProvider = ({
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

  const lookup = (tmdbId: number) => lookupTmdbCatalogEntry(actions.catalog, tmdbId, "MOVIE");
  const titleIdOf = (tmdbId: number) => {
    const id = lookup(tmdbId)?.titleId ?? null;
    return id && !id.startsWith("pending:") ? id : null;
  };
  const resultHref = (result: TmdbCatalogResult, titleId: string | null) =>
    titleId && !titleId.startsWith("pending:") ? ownedFichaHref(titleId) : previewFichaHref(result.kind, result.tmdbId);
  const resultStatus = (result: TmdbCatalogResult) => {
    const local = lookup(result.tmdbId);
    const status: SearchRowStatus = local?.watched ? "watched" : local?.inWatchlist ? "watchlist" : null;
    return { titleId: local?.titleId ?? null, status };
  };

  const value: CineActionsValue = {
    hrefFor: (film) => resultHref(toResult(film), titleIdOf(film.tmdbId)),
    statusOf: (film) => resultStatus(toResult(film)).status,
    openMenu: (film, anchor) => setMenu({ result: toResult(film), anchor }),
  };

  return (
    <CineActionsContext.Provider value={value}>
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
    </CineActionsContext.Provider>
  );
};
