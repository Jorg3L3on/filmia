import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { SearchBodySkeleton } from "@/components/PageSkeletons";
import { TmdbSearchAdd } from "@/components/TmdbSearchAdd";
import type { PersonViewState } from "@/components/tmdb-search/PersonSearch";
import { loadPersonFilmography } from "@/app/actions/metadata";
import { isPersonRole } from "@/lib/person-filmography";
import { TmdbSearchUnavailable } from "@/components/TmdbSearchUnavailable";
import { metadataServicesConfigured } from "@/lib/metadata";
import {
  getAssignableLists,
  getUserListMembershipIndex,
  getUserTmdbIndex,
} from "@/lib/queries";
import { parseOptionalIsoDate } from "@/lib/dates";
import { parseSearchKind } from "@/lib/search-session";
import { requireUserId } from "@/lib/session";
import { getPinnedTonightTitleId } from "@/lib/tonight-store";

export const metadata: Metadata = {
  title: "Buscar",
};

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string | string[];
  fecha?: string | string[];
  destino?: string | string[];
  tipo?: string | string[];
  persona?: string | string[];
  rol?: string | string[];
  nombre?: string | string[];
};

const single = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

/** `?persona=<tmdbPersonId>&rol=director|reparto|fotografia` → the person view. */
const loadPersonView = async (params: SearchParams): Promise<PersonViewState | null> => {
  const personId = Number(single(params.persona));
  if (!Number.isInteger(personId) || personId <= 0) {
    return null;
  }
  const rawRole = single(params.rol);
  const role = isPersonRole(rawRole) ? rawRole : "director";
  const name = single(params.nombre)?.trim() || null;
  const outcome = await loadPersonFilmography(personId, role);
  if (!outcome.ok) {
    return { kind: "error", error: outcome.error, personId, role, name };
  }
  const data = outcome.data.person.name
    ? outcome.data
    : { ...outcome.data, person: { ...outcome.data.person, name: name ?? "" } };
  return { kind: "ready", data };
};

export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader
        title="Buscar"
        description="Lo que añades se guarda en tu Filmia: en Quiero ver, como vista o en tus listas."
      />
      <Suspense fallback={<SearchBodySkeleton />}>
        <SearchBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const SearchBody = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) => {
  const configured = metadataServicesConfigured();
  if (!configured.tmdb) {
    return <TmdbSearchUnavailable />;
  }

  const params = await searchParams;
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const watchedDate = parseOptionalIsoDate(params.fecha);
  const markWatched =
    watchedDate != null ||
    (typeof params.destino === "string" && params.destino === "visto");
  const userId = await requireUserId();
  const [existing, lists, memberships, pinnedTitleId, person] = await Promise.all([
    getUserTmdbIndex(),
    getAssignableLists(),
    getUserListMembershipIndex(),
    markWatched ? null : getPinnedTonightTitleId(userId),
    loadPersonView(params),
  ]);

  return (
    <TmdbSearchAdd
      configured={configured}
      existing={existing}
      initialQuery={initialQuery}
      watchedDate={watchedDate}
      defaultDestination={markWatched ? "watched" : "watchlist"}
      lists={lists.map(({ id, name, slug }) => ({ id, name, slug }))}
      memberships={memberships}
      pinnedTitleId={pinnedTitleId}
      initialMode={single(params.tipo) === "director" ? "director" : "titles"}
      initialKind={parseSearchKind(params.tipo)}
      person={person}
    />
  );
};
