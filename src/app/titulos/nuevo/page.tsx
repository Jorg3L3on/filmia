import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { TitleForm } from "@/components/TitleForm";
import { metadataServicesConfigured } from "@/lib/metadata";
import { getCollectionLists, getTagFilters } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Registrar título",
};

export const dynamic = "force-dynamic";

export default async function NewTitlePage() {
  const [tags, lists, metadataConfig] = await Promise.all([
    getTagFilters(),
    getCollectionLists(),
    Promise.resolve(metadataServicesConfigured()),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Alta manual"
        title="Registrar título"
        description="Buscar es la forma habitual de añadir. Esto es el alta a mano si TMDB no alcanza."
        backHref="/buscar"
        backLabel="Volver a buscar"
        actions={
          <Button href="/buscar">
            Ir a Buscar
          </Button>
        }
      />

      <TitleForm tags={tags} lists={lists} metadataConfig={metadataConfig} />
    </div>
  );
}
