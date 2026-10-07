import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { TitleForm } from "@/components/TitleForm";
import { isSeriesStatusListSlug } from "@/lib/lists";
import { metadataServicesConfigured } from "@/lib/metadata";
import { getCollectionLists, getTitleById } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditTitlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [title, lists, metadataConfig] = await Promise.all([
    getTitleById(id),
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
        lists={lists.filter((list) => !isSeriesStatusListSlug(list.slug))}
        metadataConfig={metadataConfig}
      />
    </div>
  );
}
