import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { TmdbSearchAdd } from "@/components/TmdbSearchAdd";
import { metadataServicesConfigured, searchTmdbCatalog } from "@/lib/metadata";
import { getUserStreamingPlatforms, getUserTmdbIndex } from "@/lib/queries";
import { catalogHref } from "@/lib/tags";
import { tmdbErrorMessage } from "@/lib/tmdb";
import { btnGhost, btnLink, focusRing, wellClass } from "@/lib/ui";

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
  const [existing, userPlatforms] = await Promise.all([
    getUserTmdbIndex(),
    getUserStreamingPlatforms(),
  ]);
  const hasStreamingPlatforms = userPlatforms.length > 0;

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
      <section className={`${wellClass} space-y-2 p-4`} aria-label="Filtro de plataformas">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
          Mis plataformas
        </p>
        <p className="text-sm text-fog">
          La búsqueda de TMDB no filtra por streaming (aún no hay cache). Para
          ver solo lo incluido en tus suscripciones, usa el diario o Quiero ver.
        </p>
        {hasStreamingPlatforms ? (
          <p className="text-sm">
            <Link
              href="/"
              className={`text-accent underline-offset-2 hover:underline ${focusRing}`}
            >
              Diario: picks en tus plataformas
            </Link>
            {" · "}
            <Link
              href={catalogHref("/watchlist", { minePlatforms: true })}
              className={`text-accent underline-offset-2 hover:underline ${focusRing}`}
            >
              Quiero ver
            </Link>
          </p>
        ) : (
          <p className="text-sm">
            <Link href="/perfil" className={btnLink} aria-label="Elige tus plataformas en el perfil">
              Elige tus plataformas
            </Link>{" "}
            para ver picks en el Diario y filtrar Quiero ver.
          </p>
        )}
      </section>
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
