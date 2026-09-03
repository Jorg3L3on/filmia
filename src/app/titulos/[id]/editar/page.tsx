import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { TitleForm } from "@/components/TitleForm";
import { metadataServicesConfigured } from "@/lib/metadata";
import { getCollectionLists, getTags, getTitleById } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditTitlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [title, tags, lists, metadataConfig] = await Promise.all([
    getTitleById(id),
    getTags(),
    getCollectionLists(),
    Promise.resolve(metadataServicesConfigured()),
  ]);

  if (!title) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader eyebrow="Editar" title={title.name} />
      <TitleForm
        title={title}
        tags={tags}
        lists={lists}
        metadataConfig={metadataConfig}
      />
    </div>
  );
}
