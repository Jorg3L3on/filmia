import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { TmdbSearchAdd } from "@/components/TmdbSearchAdd";
import { metadataServicesConfigured, searchTmdbCatalog } from "@/lib/metadata";
import { getUserTmdbIndex } from "@/lib/queries";
import { tmdbErrorMessage } from "@/lib/tmdb";
import { btnGhost } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Buscar",
};

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialQuery = typeof params.q === "string" ? params.q : "";
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
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow="Descubrir"
        title="Buscar títulos"
        description="Busca en TMDB, mira el poster, el año y el tipo, y agrégalo a Filmia en un toque."
        actions={
          <Link href="/titulos/nuevo" className={btnGhost}>
            Registro manual
          </Link>
        }
      />
      <TmdbSearchAdd
        configured={metadataConfig}
        existing={existing}
        initialQuery={initialQuery}
        initialResults={initialResults}
        initialError={initialError}
      />
    </div>
  );
}
