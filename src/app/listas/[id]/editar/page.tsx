import { notFound } from "next/navigation";
import { ListForm } from "@/components/ListForm";
import { PageHeader } from "@/components/PageHeader";
import { isFixedListSlug } from "@/lib/lists";
import { getListById } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = await getListById(id);

  if (!list) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        eyebrow={isFixedListSlug(list.slug) ? "Lista diaria" : "Editar"}
        title={list.name}
        description={
          isFixedListSlug(list.slug)
            ? "Puedes ajustar la descripción. El nombre se queda."
            : undefined
        }
      />
      <ListForm list={list} />
    </div>
  );
}
