import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchBodySkeleton } from "@/components/PageSkeletons";
import { TmdbSearchAdd } from "@/components/TmdbSearchAdd";
import { metadataServicesConfigured } from "@/lib/metadata";
import { getUserTmdbIndex } from "@/lib/queries";
import { parseOptionalIsoDate } from "@/lib/dates";

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
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-serif text-4xl tracking-tight text-paper">Buscar</h1>
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
