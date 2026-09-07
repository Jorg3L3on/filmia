import Link from "next/link";
import { notFound } from "next/navigation";
import { TitleForm } from "@/components/TitleForm";
import { metadataServicesConfigured } from "@/lib/metadata";
import { getCollectionLists, getTagFilters, getTitleById } from "@/lib/queries";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

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
      <header className="flex items-center gap-3">
        <Link
          href={`/titulos/${title.id}`}
          aria-label="Volver a la ficha"
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-fog hover:bg-well hover:text-paper ${focusRing}`}
        >
          ←
        </Link>
        <h1 className="font-serif text-2xl text-paper">Editar título</h1>
      </header>
      <TitleForm
        title={title}
        tags={tags}
        lists={lists}
        metadataConfig={metadataConfig}
      />
    </div>
  );
}
