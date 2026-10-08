import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { SearchBodySkeleton } from "@/components/PageSkeletons";
import { TmdbSearchAdd } from "@/components/TmdbSearchAdd";
import { TmdbSearchUnavailable } from "@/components/TmdbSearchUnavailable";
import { metadataServicesConfigured } from "@/lib/metadata";
import {
  getAssignableLists,
  getUserListMembershipIndex,
  getUserTmdbIndex,
} from "@/lib/queries";
import { parseOptionalIsoDate } from "@/lib/dates";
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
  const [existing, lists, memberships, pinnedTitleId] = await Promise.all([
    getUserTmdbIndex(),
    getAssignableLists(),
    getUserListMembershipIndex(),
    markWatched ? null : getPinnedTonightTitleId(userId),
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
    />
  );
};
