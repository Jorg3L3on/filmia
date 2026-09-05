import type { Metadata } from "next";
import { TmdbSearchAdd } from "@/components/TmdbSearchAdd";
import { metadataServicesConfigured, searchTmdbCatalog } from "@/lib/metadata";
import { getUserTmdbIndex } from "@/lib/queries";
import { parseOptionalIsoDate } from "@/lib/dates";
import { tmdbErrorMessage } from "@/lib/tmdb";

export const metadata: Metadata = {
  title: "Buscar",
};

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    fecha?: string | string[];
    destino?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const watchedDate = parseOptionalIsoDate(params.fecha);
  const markWatched =
    watchedDate != null ||
    (typeof params.destino === "string" && params.destino === "visto");
  const metadataConfig = metadataServicesConfigured();
  const existing = await getUserTmdbIndex();

  let initialResults: Awaited<ReturnType<typeof searchTmdbCatalog>> = [];
  let initialError: string | null = null;

  if (initialQuery.trim() && metadataConfig.tmdb) {
    try {
      initialResults = await searchTmdbCatalog(initialQuery);
      if (initialResults.length === 0) {
        initialError = "Nada en TMDB con esa búsqueda.";
      }
    } catch (error) {
      initialError = tmdbErrorMessage(error);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-serif text-4xl tracking-tight text-paper">Buscar</h1>
      <TmdbSearchAdd
        configured={metadataConfig}
        existing={existing}
        initialQuery={initialQuery}
        initialResults={initialResults}
        initialError={initialError}
        watchedDate={watchedDate}
        defaultDestination={markWatched ? "watched" : "watchlist"}
      />
    </div>
  );
}
