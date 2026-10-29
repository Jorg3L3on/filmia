import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { addTitleToList } from "@/app/actions/lists";
import { AddTitleToListCta } from "@/components/AddTitleToListCta";
import { CatalogFilters } from "@/components/CatalogFilters";
import { EmptyState } from "@/components/EmptyState";
import { ListTitlesView } from "@/components/ListTitlesView";
import { NavLabel } from "@/components/NavOriginTracker";
import {
  MinePlatformsEmpty,
  MinePlatformsSetupCta,
  MissingStreamingDataNote,
} from "@/components/MinePlatformsNotice";
import { ListsBodySkeleton } from "@/components/PageSkeletons";
import { PageHeader } from "@/components/PageHeader";
import { ShareButton, ShareIcon } from "@/components/share/ShareButton";
import {
  parseCatalogOrder,
  parseKindFilter,
  parsePlatformFilters,
  sortCatalogByTitle,
  titleMatchesKind,
} from "@/lib/catalog-filters";
import {
  emptyStateForList,
  isFixedListSlug,
  isSeriesStatusListSlug,
  WATCHLIST_SLUG,
} from "@/lib/lists";
import { slugify } from "@/lib/labels";
import { canOnList, shareableRoles } from "@/lib/list-access-core";
import { canWatchTogether } from "@/lib/group-access";
import { chosenOfList } from "@/lib/group-store";
import { getListPeople, getPeopleNames, getPendingRequests } from "@/lib/list-invites";
import { personFirstName } from "@/lib/person-avatar";
import { AvatarStack } from "@/components/lists/PersonAvatar";
import { ShareListSheet } from "@/components/lists/ShareListSheet";
import { OwnerRequestsNotice } from "@/components/lists/SharedWithMe";
import { metadataServicesConfigured } from "@/lib/metadata";
import { listShareText } from "@/lib/share-card";
import { sharePath } from "@/lib/share-token";
import { parseDeckCard } from "@/lib/nav-origin";
import { getListById, getTitleOptionsOutsideList, getUserStreamingPlatforms } from "@/lib/queries";
import { resolveCatalogAvailability } from "@/lib/streaming-platforms";
import { tmdbCatalogKey } from "@/lib/tmdb-search-catalog";
import { catalogHref, parseMinePlatforms } from "@/lib/catalog-href";
import { parseSeriesStatusFilter, titleMatchesSeriesStatus } from "@/lib/series";
import {
  PencilIcon,
  SegmentActionTooltip,
  segmentActionCompactClass,
} from "@/components/SegmentAction";

export const dynamic = "force-dynamic";

export default function ListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    minePlatforms?: string | string[];
    seriesStatus?: string | string[];
    kind?: string | string[];
    platform?: string | string[];
    sort?: string | string[];
    carta?: string | string[];
  }>;
}) {
  return (
    <Suspense fallback={<ListsBodySkeleton label="Cargando lista" />}>
      <ListDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const ListDetail = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    minePlatforms?: string | string[];
    seriesStatus?: string | string[];
    kind?: string | string[];
    platform?: string | string[];
    sort?: string | string[];
    carta?: string | string[];
  }>;
}) => {
  const { id } = await params;
  const query = await searchParams;
  const minePlatforms = parseMinePlatforms(query.minePlatforms);
  const seriesStatus = parseSeriesStatusFilter(query.seriesStatus);
  const kindFilter = parseKindFilter(query.kind);
  const platforms = parsePlatformFilters(query.platform);
  const sort = parseCatalogOrder(query.sort);
  const [list, availableTitles, userPlatforms] = await Promise.all([
    getListById(id),
    getTitleOptionsOutsideList(id),
    getUserStreamingPlatforms(),
  ]);

  if (!list) {
    notFound();
  }

  // Shared lists (FIL-I18): who is on it, who added what, who is asking to join.
  const [people, requests] = await Promise.all([
    getListPeople(list.id),
    list.role === "OWNER" ? getPendingRequests(list.id) : Promise.resolve([]),
  ]);
  const shared = people.length > 1;
  const addedByNames = shared
    ? await getPeopleNames(list.items.flatMap((item) => (item.addedByUserId ? [item.addedByUserId] : [])))
    : undefined;
  const ownerName = people.find((person) => person.role === "OWNER")?.name ?? null;
  const shareRoles = shareableRoles(list);
  // «Qué vemos juntos» (FIL-I19-3): lists with an editor, for the owner and editors.
  const together = canWatchTogether(list, list.role, people);
  const chosen = together ? await chosenOfList(list.id) : null;

  if (list.kind === "WATCHLIST" || list.slug === WATCHLIST_SLUG) {
    redirect("/watchlist");
  }
  const statusItems = list.items.filter(
    (item) =>
      titleMatchesKind(item.title.kind, kindFilter) &&
      titleMatchesSeriesStatus(item.title, seriesStatus),
  );
  const catalog = resolveCatalogAvailability(
    statusItems.map((item) => item.title),
    { platforms, minePlatforms, userPlatforms },
  );
  const visibleIds = new Set(catalog.titles.map((title) => title.id));
  const visibleItems = sortCatalogByTitle(
    catalog.needsSetup
      ? []
      : platforms.length > 0 || minePlatforms
        ? statusItems.filter((item) => visibleIds.has(item.title.id))
        : statusItems,
    sort,
  );
  const addAction = addTitleToList.bind(null, list.id);
  const configuredTmdb = metadataServicesConfigured().tmdb;
  const inListKeys = list.items.flatMap((item) =>
    item.title.tmdbId != null ? [tmdbCatalogKey(item.title.tmdbId, item.title.kind)] : [],
  );
  const fixed = isFixedListSlug(list.slug);
  // Each role sees only what it can use (FIL-I18): viewers just look.
  const isOwner = list.role === "OWNER";
  const canEditItems = canOnList(list.role, "edit_items");
  // «Series en progreso» / «Series abandonadas» las llena el estado de la serie.
  const automatic = isSeriesStatusListSlug(list.slug);
  // «Mi top de {año}» is built in Cine (only films of that year you saw): edit it there.
  const yearTop = list.kind === "YEAR_TOP" && list.year != null;
  const empty = emptyStateForList(list.slug);
  const filteredEmpty = list.items.length > 0 && visibleItems.length === 0;
  const clearHref = catalogHref(`/listas/${list.id}`, {});

  return (
    // Shell = Hoy's room: the deck tints the page with the hero poster's colour.
    <div className="diario-que-ver-shell list-sala space-y-6">
      <NavLabel label={`Listas · ${list.name}`} />
      <PageHeader
        title={list.name}
        description={list.description ?? undefined}
        backHref="/listas"
        backLabel="Todas las listas"
      />

      <div className="flex flex-wrap items-center gap-2">
        {automatic || yearTop || !canEditItems ? null : (
          <AddTitleToListCta
            action={addAction}
            titles={availableTitles}
            listId={list.id}
            configuredTmdb={configuredTmdb}
            inListKeys={inListKeys}
            compact
          />
        )}
        {isOwner && shareRoles.length > 0 ? (
          <ShareListSheet
            listId={list.id}
            listName={list.name}
            roles={shareRoles}
            compact
            publicShare={
              <ShareButton
                path={sharePath("lista", list.id)}
                title={list.name}
                text={listShareText(list.name, list.items.length)}
                fileName={`${slugify(list.name) || "lista"}.png`}
                ariaLabel="Mandar la vista pública"
                className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-paper"
              >
                Vista pública
              </ShareButton>
            }
          />
        ) : null}
        {isOwner && shareRoles.length === 0 ? (
          <ShareButton
            path={sharePath("lista", list.id)}
            title={list.name}
            text={listShareText(list.name, list.items.length)}
            fileName={`${slugify(list.name) || "lista"}.png`}
            ariaLabel="Compartir lista"
            className={segmentActionCompactClass}
          >
            <ShareIcon className="size-5" />
            <SegmentActionTooltip label="Compartir lista" />
          </ShareButton>
        ) : null}
        {isOwner ? (
          <Link
            href={yearTop ? `/cine/mejor/${list.year}` : `/listas/${list.id}/editar`}
            aria-label={yearTop ? "Editar en Cine" : fixed ? "Editar descripción" : "Editar lista"}
            className={segmentActionCompactClass}
          >
            <PencilIcon className="size-5 group-hover/action:-rotate-12" />
            <SegmentActionTooltip label={yearTop ? "Editar en Cine" : fixed ? "Editar descripción" : "Editar lista"} />
          </Link>
        ) : null}
        {isOwner && shareRoles.length > 0 && !shared ? (
          <Link
            href={`/listas/${list.id}/miembros`}
            aria-label="Miembros y links"
            className={segmentActionCompactClass}
          >
            <PeopleIcon className="size-5" />
            <SegmentActionTooltip label="Miembros y links" />
          </Link>
        ) : null}
        <CatalogFilters
          pathname={`/listas/${list.id}`}
          kind={kindFilter}
          platforms={platforms}
          sort={sort ?? undefined}
          minePlatforms={minePlatforms}
          hasStreamingPlatforms={userPlatforms.length > 0}
          seriesStatus={seriesStatus}
          showKindChips={false}
          inline
        />
      </div>

      {shared ? (
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/listas/${list.id}/miembros`}
            className="inline-flex items-center gap-2 rounded-full text-sm text-fog hover:text-paper"
            aria-label={`Miembros: ${people.length} personas`}
          >
            <AvatarStack people={people} />
            {people.length} personas
          </Link>
          {isOwner ? null : (
            <span className="text-sm text-fog">Lista de {personFirstName(ownerName)}</span>
          )}
          {list.role === "VIEWER" ? (
            <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-paper">
              Solo ver
            </span>
          ) : null}
        </div>
      ) : null}

      {together ? (
        <div className="space-y-3">
          <Link
            href={`/listas/${list.id}/juntos`}
            className="flex items-center justify-between gap-3 rounded-3xl px-4 py-3 text-paper shadow-lg"
            style={{ backgroundImage: "linear-gradient(120deg, rgb(201 178 255 / 0.32), rgb(255 122 69 / 0.32))" }}
          >
            <span>
              <span className="block text-[15px] font-semibold">Qué vemos juntos</span>
              <span className="block text-xs text-paper/75">Cruza los gustos de quienes ven hoy</span>
            </span>
            <span aria-hidden="true" className="text-lg">›</span>
          </Link>
          {chosen ? (
            <p className="text-sm text-fog">
              Vamos con esta:{" "}
              <Link href={`/titulos/${chosen.catalogId}`} className="font-semibold text-accent">
                {chosen.name}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {isOwner ? (
        <OwnerRequestsNotice
          requests={requests.map((request) => ({ ...request, listId: list.id, listName: list.name }))}
        />
      ) : null}

      {list.items.length === 0 ? (
        <>
          {automatic || yearTop || !canEditItems ? null : (
            <AddTitleToListCta
              action={addAction}
              titles={availableTitles}
              listId={list.id}
              configuredTmdb={configuredTmdb}
              inListKeys={inListKeys}
            />
          )}
          <EmptyState
            variant={empty.variant}
            title={empty.title}
            description={empty.description}
            actionHref={empty.actionHref}
            actionLabel={empty.actionLabel}
          />
        </>
      ) : catalog.needsSetup ? (
        <MinePlatformsSetupCta />
      ) : filteredEmpty && minePlatforms ? (
        <>
          <MissingStreamingDataNote count={catalog.missingCache} />
          <MinePlatformsEmpty
            userPlatforms={userPlatforms}
            actionHref={clearHref}
            hasFilters={Boolean(seriesStatus)}
          />
        </>
      ) : filteredEmpty ? (
        <EmptyState
          title="Nada con esos filtros"
          description="Esta lista no tiene títulos con los filtros elegidos. El estado de serie ignora películas."
          actionHref={clearHref}
          actionLabel="Quitar filtros"
        />
      ) : (
        <div className="list-sala-deck space-y-4">
          <MissingStreamingDataNote count={catalog.missingCache} />
          <ListTitlesView
            listId={automatic || !canEditItems ? undefined : list.id}
            items={visibleItems}
            platforms={platforms}
            initialCardId={parseDeckCard(query.carta)}
            addedByNames={addedByNames}
          />
        </div>
      )}
    </div>
  );
};

const PeopleIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="3" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a3 3 0 0 1 0 5.75" />
  </svg>
);
