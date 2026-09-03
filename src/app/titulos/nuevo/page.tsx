import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { TitleForm } from "@/components/TitleForm";
import { metadataServicesConfigured } from "@/lib/metadata";
import { getCollectionLists, getTags } from "@/lib/queries";

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
        description="Busca el poster, ponle tu nota y súbelo al diario. La cola de pendientes vive en Por ver."
      />
      <TitleForm tags={tags} lists={lists} metadataConfig={metadataConfig} />
    </div>
  );
}
