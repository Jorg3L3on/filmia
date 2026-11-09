"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { FunnelIcon } from "@/components/CatalogMoreFilters";
import { CatalogFilterSheet } from "@/components/catalog-filters/CatalogFilterSheet";
import { CatalogSortSheet } from "@/components/catalog-filters/CatalogSortSheet";
import { useCatalogFiltersState } from "@/components/catalog-filters/useCatalogFiltersState";
import { ShareListSheet } from "@/components/lists/ShareListSheet";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { ShareButton, ShareIcon } from "@/components/share/ShareButton";
import { ChevronIcon, DotsIcon, PenIcon, SortIcon } from "@/components/watchlist/icons";
import type { ListRole, Platform } from "@/db";
import { CATALOG_ORDER_OPTIONS } from "@/lib/catalog-filters";
import type { CatalogKindFilter } from "@/lib/catalog-href";
import { cn } from "@/lib/cn";
import type { SeriesStatusFilter } from "@/lib/series";
import { focusRing, glassIconClass } from "@/lib/ui";

type ListShare =
  | {
      /** Owner of a shareable list: invite links (and the public view inside the sheet). */
      mode: "invite";
      listId: string;
      listName: string;
      roles: ListRole[];
      publicShare?: ReactNode;
    }
  | {
      /** Owner of a list that cannot take members: the public view only. */
      mode: "public";
      path: string;
      title: string;
      text: string;
      fileName: string;
    };

type ListHeaderActionsProps = {
  /** «+ Agregar» (AddTitleToListCta pill); null when the role or list cannot add. */
  add?: ReactNode;
  share?: ListShare | null;
  edit?: { href: string; label: string } | null;
  membersHref?: string | null;
  filters: {
    pathname: string;
    kind: CatalogKindFilter;
    platforms: Platform[];
    sort?: string;
    minePlatforms: boolean;
    hasStreamingPlatforms: boolean;
    seriesStatus?: SeriesStatusFilter;
  };
};

const rowClass = cn(
  "press-scale flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-medium text-paper hover:bg-chrome/60",
  focusRing,
);

const Disc = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent ring-1 ring-accent/25">
    {children}
  </span>
);

const RowText = ({ title, hint }: { title: string; hint?: string }) => (
  <span className="min-w-0 flex-1">
    {title}
    {hint ? <span className="block truncate text-xs font-normal text-fog">{hint}</span> : null}
  </span>
);

type Panel = "menu" | "sort" | "filters" | "share" | null;

/**
 * List header (FIL-I44-2): one labelled action («+ Agregar») and one «···» that holds the rest
 * — order, filters, share, edit, members — instead of five equal glass buttons in a row.
 */
export const ListHeaderActions = ({ add, share, edit, membersHref, filters }: ListHeaderActionsProps) => {
  const headingId = useId();
  const [panel, setPanel] = useState<Panel>(null);
  const {
    applied,
    open: filtersOpen,
    draft,
    setDraft,
    sheetActiveCount,
    handleOpen: openFilters,
    handleClose: closeFilters,
    handleApply,
    handleClear,
    handleSortSelect,
  } = useCatalogFiltersState({
    pathname: filters.pathname,
    sort: filters.sort,
    minePlatforms: filters.minePlatforms,
    seriesStatus: filters.seriesStatus,
    kind: filters.kind,
    platforms: filters.platforms,
  });
  // Tipo lives only in the sheet here, so it counts like the other filters.
  const activeCount = sheetActiveCount + (applied.kind !== "ALL" ? 1 : 0);
  const sortLabel = CATALOG_ORDER_OPTIONS.find((option) => option.id === applied.sort)?.label ?? "Como la armaste";

  const closeMenu = () => setPanel(null);
  // One panel at a time: the menu slides away while the chosen sheet rises.
  const goTo = (next: Exclude<Panel, "menu" | null>) => {
    if (next === "filters") {
      setPanel(null);
      openFilters();
    } else {
      setPanel(next);
    }
  };

  const activeLabel = `${activeCount} ${activeCount === 1 ? "filtro activo" : "filtros activos"}`;
  const menuLabel = activeCount > 0 ? `Más acciones de la lista, ${activeLabel}` : "Más acciones de la lista";

  return (
    <div className="flex items-center gap-2">
      {add}
      <button
        type="button"
        onClick={() => setPanel("menu")}
        aria-haspopup="dialog"
        aria-expanded={panel === "menu"}
        aria-label={menuLabel}
        className={cn(glassIconClass, "size-10")}
      >
        <DotsIcon size={20} />
        {activeCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-ink"
          >
            {activeCount}
          </span>
        ) : null}
      </button>

      <Sheet
        open={panel === "menu"}
        onClose={closeMenu}
        labelledBy={headingId}
        overlayLabel="Cerrar acciones"
        align="bottom"
        dragDismiss
        portal
      >
        <div className="flex flex-col items-center px-5 pt-3">
          <SheetHandle />
          <h2 id={headingId} className="w-full text-left font-serif text-xl text-paper">
            Esta lista
          </h2>
        </div>
        <div role="menu" aria-labelledby={headingId} className="space-y-0.5 px-3 pb-2 pt-3" data-no-sheet-drag>
          <button type="button" role="menuitem" onClick={() => goTo("sort")} className={rowClass}>
            <Disc><SortIcon size={18} /></Disc>
            <RowText title="Ordenar" hint={sortLabel} />
            <span aria-hidden="true" className="-rotate-90 text-fog"><ChevronIcon /></span>
          </button>
          <button type="button" role="menuitem" onClick={() => goTo("filters")} className={rowClass}>
            <Disc><FunnelIcon /></Disc>
            <RowText
              title="Filtrar"
              hint={activeCount > 0 ? activeLabel : "Tipo y plataforma"}
            />
            <span aria-hidden="true" className="-rotate-90 text-fog"><ChevronIcon /></span>
          </button>

          {share || edit || membersHref ? (
            <span aria-hidden="true" className="mx-3 my-1 block h-px bg-white/8" />
          ) : null}

          {share?.mode === "invite" ? (
            <button type="button" role="menuitem" onClick={() => goTo("share")} className={rowClass}>
              <Disc><ShareIcon className="size-[18px]" /></Disc>
              <RowText title="Compartir" hint="Invita a alguien o manda la vista pública" />
            </button>
          ) : share?.mode === "public" ? (
            <div role="none" onClick={closeMenu}>
              <ShareButton
                path={share.path}
                title={share.title}
                text={share.text}
                fileName={share.fileName}
                ariaLabel="Compartir lista"
                className={rowClass}
              >
                <Disc><ShareIcon className="size-[18px]" /></Disc>
                <RowText title="Compartir" hint="Manda la vista pública" />
              </ShareButton>
            </div>
          ) : null}
          {edit ? (
            <Link role="menuitem" href={edit.href} onClick={closeMenu} className={rowClass}>
              <Disc><PenIcon /></Disc>
              <RowText title={edit.label} />
            </Link>
          ) : null}
          {membersHref ? (
            <Link role="menuitem" href={membersHref} onClick={closeMenu} className={rowClass}>
              <Disc><PeopleIcon /></Disc>
              <RowText title="Miembros y links" />
            </Link>
          ) : null}
        </div>
      </Sheet>

      <CatalogSortSheet
        options={CATALOG_ORDER_OPTIONS}
        current={applied.sort}
        onSelect={handleSortSelect}
        open={panel === "sort"}
        onOpenChange={(next) => setPanel(next ? "sort" : null)}
        hideTrigger
      />
      <CatalogFilterSheet
        open={filtersOpen}
        activeCount={activeCount}
        draft={draft}
        hasStreamingPlatforms={filters.hasStreamingPlatforms}
        showKind
        showPlatforms
        onOpen={openFilters}
        onClose={closeFilters}
        onClear={handleClear}
        onApply={handleApply}
        onDraftChange={setDraft}
        hideTrigger
      />
      {share?.mode === "invite" ? (
        <ShareListSheet
          listId={share.listId}
          listName={share.listName}
          roles={share.roles}
          publicShare={share.publicShare}
          open={panel === "share"}
          onOpenChange={(next) => setPanel(next ? "share" : null)}
          hideTrigger
        />
      ) : null}
    </div>
  );
};

const PeopleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={18}
    height={18}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="3" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a3 3 0 0 1 0 5.75" />
  </svg>
);
