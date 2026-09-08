import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { SearchBodySkeleton } from "@/components/PageSkeletons";
import { TmdbSearchAdd } from "@/components/TmdbSearchAdd";
import { metadataServicesConfigured } from "@/lib/metadata";
import { getUserTmdbIndex } from "@/lib/queries";
import { parseOptionalIsoDate } from "@/lib/dates";
import { AUTH_PAGE_DYNAMIC } from "@/lib/rendering";

export const metadata: Metadata = {
  title: "Buscar",
};

export const dynamic = AUTH_PAGE_DYNAMIC;

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
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Buscar"
        description="Añade a Quiero ver, márcala vista o ábrela en la ficha para listas."
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
  const params = await searchParams;
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const watchedDate = parseOptionalIsoDate(params.fecha);
  const markWatched =
    watchedDate != null ||
    (typeof params.destino === "string" && params.destino === "visto");
  const existing = await getUserTmdbIndex();

  return (
    <TmdbSearchAdd
      configured={metadataServicesConfigured()}
      existing={existing}
      initialQuery={initialQuery}
      watchedDate={watchedDate}
      defaultDestination={markWatched ? "watched" : "watchlist"}
    />
  );
};
