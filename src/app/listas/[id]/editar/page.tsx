import { notFound } from "next/navigation";
import { ListForm } from "@/components/ListForm";
import { PageHeader } from "@/components/PageHeader";
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
      <PageHeader eyebrow="Editar" title={list.name} />
      <ListForm list={list} />
    </div>
  );
}
