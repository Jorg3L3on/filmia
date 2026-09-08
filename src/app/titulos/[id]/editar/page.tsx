import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { TitleForm } from "@/components/TitleForm";
import { metadataServicesConfigured } from "@/lib/metadata";
import { getCollectionLists, getTagFilters, getTitleById } from "@/lib/queries";
import { AUTH_PAGE_DYNAMIC } from "@/lib/rendering";

export const dynamic = AUTH_PAGE_DYNAMIC;

export default async function EditTitlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [title, tags, lists, metadataConfig] = await Promise.all([
    getTitleById(id),
    getTagFilters(),
    getCollectionLists(),
    Promise.resolve(metadataServicesConfigured()),
  ]);

  if (!title) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Ficha"
        title="Editar título"
        backHref={`/titulos/${title.id}`}
        backLabel="Volver a la ficha"
      />
      <TitleForm
        title={title}
        tags={tags}
        lists={lists}
        metadataConfig={metadataConfig}
      />
    </div>
  );
}
