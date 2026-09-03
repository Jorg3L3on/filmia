import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { TitleForm } from "@/components/TitleForm";
import { metadataServicesConfigured } from "@/lib/metadata";
import { getCollectionLists, getTags } from "@/lib/queries";
import { btnPrimary, wellClass } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Nuevo título",
};

export const dynamic = "force-dynamic";

export default async function NewTitlePage() {
  const [tags, lists, metadataConfig] = await Promise.all([
    getTags(),
    getCollectionLists(),
    Promise.resolve(metadataServicesConfigured()),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow="Alta"
        title="Registrar título"
        description="Busca el poster, ponle tu nota y súbelo al diario. La cola de pendientes vive en Quiero ver."
        actions={
          <Link href="/buscar" className={btnPrimary}>
            Buscar en TMDB
          </Link>
        }
      />
      <Link
        href="/buscar"
        className={`${wellClass} block p-5 transition hover:border-accent/50`}
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
          Camino rápido
        </p>
        <p className="mt-1 font-serif text-xl text-white">
          Buscar y agregar desde TMDB
        </p>
        <p className="mt-1 text-sm text-fog">
          Poster, año y tipo en un toque. También puedes mandarlo a Quiero ver.
        </p>
      </Link>
      <TitleForm tags={tags} lists={lists} metadataConfig={metadataConfig} />
    </div>
  );
}
