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
        eyebrow="Catálogo"
        title="Registrar título"
        backHref="/buscar"
        backLabel="Volver a buscar"
        actions={
          <Button href="/buscar" variant="ghost">
            Buscar en TMDB
          </Button>
        }
      />

      <TitleForm tags={tags} lists={lists} metadataConfig={metadataConfig} />
    </div>
  );
}
